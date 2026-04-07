import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

const BACKUP_TABLES = [
    'users', 'customers', 'cards', 'campaigns', 'transactions',
    'customer_coupons', 'customer_campaign_progress', 'discounts',
    'audit_logs', 'scan_events', 'terminals', 'branches',
    'balance_ledger', 'terminal_actions',
];

function normalizeBackupPayload(raw) {
    if (!raw || typeof raw !== 'object') return {};

    if (raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)) {
        return raw.data;
    }

    const out = {};
    for (const [k, v] of Object.entries(raw)) {
        if (['meta', 'metadata', 'row_counts'].includes(k)) continue;
        if (Array.isArray(v)) out[k] = v;
    }
    return out;
}

function restoreOrder(tableNames) {
    const preferred = [
        'branches', 'users', 'customers', 'cards', 'campaigns', 'discounts',
        'terminals', 'transactions', 'customer_coupons',
        'customer_campaign_progress', 'balance_ledger', 'scan_events',
        'terminal_actions', 'audit_logs',
    ];

    const inPayload = new Set(tableNames);
    const ordered = preferred.filter((t) => inPayload.has(t));
    const rest = tableNames.filter((t) => !ordered.includes(t)).sort();
    return [...ordered, ...rest];
}

function conflictColumn(table) {
    if (table === 'settings') return 'key_name';
    return 'id';
}

function chunkRows(rows, size = 500) {
    const chunks = [];
    for (let i = 0; i < rows.length; i += size) {
        chunks.push(rows.slice(i, i + size));
    }
    return chunks;
}

async function collectBackupData(tables) {
    const backupData = {};
    for (const table of tables) {
        const { data, error } = await supabase.from(table).select('*');
        if (error) throw new Error(`Failed to fetch ${table}: ${error.message}`);
        backupData[table] = data || [];
    }
    return backupData;
}

// ─── جلب القائمة + الإعداد الحالي ────────────────────────────────────────────
export async function GET(request) {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');
        const file = searchParams.get('file');

        const { supabaseAdmin } = await import('@/lib/supabase');
        if (!supabaseAdmin) return NextResponse.json({ error: 'Service Role Key Missing' }, { status: 500 });

        // تنزيل نسخة JSON مباشرة على جهاز المستخدم (بدون Storage)
        if (action === 'export') {
            const backupData = await collectBackupData(BACKUP_TABLES);
            const payload = {
                metadata: {
                    exported_at: new Date().toISOString(),
                    version: '2.1',
                    source: 'manual-export',
                    creator: session?.email || 'admin',
                    tables: BACKUP_TABLES,
                },
                data: backupData,
            };

            const fileName = `backup_local_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
            return new NextResponse(JSON.stringify(payload, null, 2), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Content-Disposition': `attachment; filename="${fileName}"`,
                },
            });
        }

        // رابط تحميل موقّع
        if (action === 'download' && file) {
            const { data, error } = await supabaseAdmin
                .storage
                .from('backups')
                .createSignedUrl(file, 60);

            if (error) throw error;
            return NextResponse.json({ signedUrl: data.signedUrl });
        }

        // جلب قائمة النسخ من Storage
        const { data: files, error: listError } = await supabaseAdmin
            .storage
            .from('backups')
            .list('data', {
                limit: 100,
                offset: 0,
                sortBy: { column: 'created_at', order: 'desc' },
            });

        if (listError) throw listError;

        // جلب إعداد الجدولة من جدول settings
        const { data: scheduleRow } = await supabase
            .from('settings')
            .select('value')
            .eq('key_name', 'backup_schedule')
            .maybeSingle();

        const { data: lastBackupRow } = await supabase
            .from('settings')
            .select('value')
            .eq('key_name', 'last_backup_at')
            .maybeSingle();

        // إعادة مسار الملف كاملاً لدعم التحميل
        const mappedFiles = (files || []).map(f => ({
            ...f,
            name: `data/${f.name}`,
        }));

        return NextResponse.json({
            files: mappedFiles,
            schedule: scheduleRow?.value || 'EVERY_12H',
            last_backup_at: lastBackupRow?.value || null,
        });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// ─── إنشاء نسخة احتياطية (يدوية أو cron) ─────────────────────────────────────
export async function POST(request) {
    const session = await getSession();
    const authHeader = request.headers.get('authorization');
    const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;

    const body = await request.json().catch(() => ({}));
    const action = body?.action || 'create';

    // Restore action: only admin from UI/session.
    if (action === 'restore') {
        if (!session || session.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        try {
            const { supabaseAdmin } = await import('@/lib/supabase');
            if (!supabaseAdmin) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing');

            const backupPayload = normalizeBackupPayload(body?.backup || {});
            const dryRun = body?.dry_run === true;
            const tableNames = restoreOrder(Object.keys(backupPayload));
            const chunkSize = Number(body?.chunk_size) > 0 ? Number(body.chunk_size) : 500;

            if (tableNames.length === 0) {
                return NextResponse.json({ error: 'Backup file is empty or invalid' }, { status: 400 });
            }

            const summary = {
                dry_run: dryRun,
                tables: {},
                total_rows: 0,
                failed_tables: [],
            };

            for (const table of tableNames) {
                const rows = Array.isArray(backupPayload[table]) ? backupPayload[table] : [];
                summary.tables[table] = { rows: rows.length, restored: 0 };
                summary.total_rows += rows.length;

                if (rows.length === 0 || dryRun) {
                    summary.tables[table].restored = dryRun ? rows.length : 0;
                    continue;
                }

                const batches = chunkRows(rows, chunkSize);
                const onConflict = conflictColumn(table);

                for (const batch of batches) {
                    let result = await supabaseAdmin
                        .from(table)
                        .upsert(batch, { onConflict, ignoreDuplicates: false });

                    if (result.error) {
                        // fallback: plain insert for tables that may not have expected conflict key
                        result = await supabaseAdmin
                            .from(table)
                            .insert(batch);
                    }

                    if (result.error) {
                        summary.failed_tables.push({
                            table,
                            message: result.error.message,
                        });
                        break;
                    }

                    summary.tables[table].restored += batch.length;
                }
            }

            await logAudit({
                action: 'BACKUP_RESTORE',
                entity: 'system',
                details: {
                    dry_run: dryRun,
                    total_rows: summary.total_rows,
                    failed_tables: summary.failed_tables,
                },
                req: request,
            });

            if (summary.failed_tables.length > 0) {
                return NextResponse.json({
                    success: false,
                    message: 'Restore completed with errors',
                    summary,
                }, { status: 207 });
            }

            return NextResponse.json({
                success: true,
                message: dryRun ? 'Dry run completed successfully' : 'Restore completed successfully',
                summary,
            });
        } catch (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
    }

    if ((!session || session.role !== 'admin') && !isCron) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // ── إذا كان Cron: تحقق من الإعداد قبل التنفيذ ──────────────────────────
    if (isCron) {
        const { data: scheduleRow } = await supabase
            .from('settings')
            .select('value')
            .eq('key_name', 'backup_schedule')
            .maybeSingle();

        const schedule = scheduleRow?.value || 'EVERY_12H';

        if (schedule === 'OFF') {
            return NextResponse.json({ skipped: true, reason: 'Backup is disabled' });
        }

        if (schedule === 'DAILY') {
            // تحقق: هل مضت 20 ساعة على الأقل منذ آخر نسخة؟
            const { data: lastRow } = await supabase
                .from('settings')
                .select('value')
                .eq('key_name', 'last_backup_at')
                .maybeSingle();

            if (lastRow?.value) {
                const elapsed = Date.now() - new Date(lastRow.value).getTime();
                if (elapsed < 20 * 60 * 60 * 1000) {
                    return NextResponse.json({ skipped: true, reason: 'Already backed up today' });
                }
            }
        }
        // EVERY_12H → ينفذ دائماً حين يُستدعى الـ cron
    }

    try {
        const source = isCron ? 'auto' : 'manual';

        const backupData = await collectBackupData(BACKUP_TABLES);

        backupData.meta = {
            created_at: new Date().toISOString(),
            version: '2.0',
            source,
            creator: session?.email || 'cron',
        };

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `data/backup_${source}_${timestamp}.json`;
        const fileContent = JSON.stringify(backupData, null, 2);

        const { supabaseAdmin } = await import('@/lib/supabase');
        if (!supabaseAdmin) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing');

        const { error: uploadError } = await supabaseAdmin
            .storage
            .from('backups')
            .upload(fileName, fileContent, {
                contentType: 'application/json',
                upsert: false,
            });

        if (uploadError) throw uploadError;

        // حفظ وقت آخر نسخة في الـ settings
        await supabase
            .from('settings')
            .upsert([{ key_name: 'last_backup_at', value: new Date().toISOString() }], {
                onConflict: 'key_name',
            });

        await logAudit({
            action: 'BACKUP',
            entity: 'system',
            entityId: fileName,
            details: { size: fileContent.length, tables: BACKUP_TABLES, source },
            req: request,
        });

        return NextResponse.json({ success: true, file: fileName, source });
    } catch (error) {
        console.error('Backup Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// ─── حفظ إعداد الجدولة ────────────────────────────────────────────────────────
export async function PATCH(request) {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { schedule } = await request.json();
        const allowed = ['OFF', 'EVERY_12H', 'DAILY'];
        if (!allowed.includes(schedule)) {
            return NextResponse.json({ error: 'Invalid schedule value' }, { status: 400 });
        }

        await supabase
            .from('settings')
            .upsert([{ key_name: 'backup_schedule', value: schedule }], {
                onConflict: 'key_name',
            });

        await logAudit({
            action: 'UPDATE_BACKUP_SCHEDULE',
            entity: 'settings',
            details: { schedule },
            req: request,
        });

        return NextResponse.json({ success: true, schedule });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
