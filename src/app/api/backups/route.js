import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

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
        // Ensure we have admin client for storage interaction
        if (!supabaseAdmin) return NextResponse.json({ error: 'Service Role Key Missing' }, { status: 500 });

        if (action === 'download' && file) {
            const { data, error } = await supabaseAdmin
                .storage
                .from('backups')
                .createSignedUrl(file, 60); // 1 minute validity

            if (error) throw error;
            return NextResponse.json({ signedUrl: data.signedUrl });
        }

        // If not a download action, proceed with listing files
        const client = supabaseAdmin || supabase; // Fallback to anon (will fail if RLS blocks, but valid attempt)

        const { data, error } = await client
            .storage
            .from('backups')
            .list('', {
                limit: 100,
                offset: 0,
                sortBy: { column: 'created_at', order: 'desc' },
            });

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request) {
    // Auth Check: Admin Session OR Cron Secret
    const { getSession } = await import('@/lib/auth');
    const session = await getSession();

    const authHeader = request.headers.get('authorization');
    const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;

    if ((!session || session.role !== 'admin') && !isCron) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        // 1. Fetch Data from all key tables
        const tables = [
            'users',
            'customers',
            'cards',
            'campaigns',
            'transactions',
            'customer_coupons',
            'customer_campaign_progress',
            'discounts',
            'audit_logs'
        ];

        const backupData = {};

        for (const table of tables) {
            const { data, error } = await supabase.from(table).select('*');
            if (error) throw new Error(`Failed to fetch ${table}: ${error.message}`);
            backupData[table] = data;
        }

        backupData.meta = {
            created_at: new Date().toISOString(),
            version: '1.0',
            creator: session.email
        };

        // 2. Prepare File
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `backup_${timestamp}.json`;
        const fileContent = JSON.stringify(backupData, null, 2);

        // 3. Upload to Storage
        // Use Admin Client to bypass RLS (since bucket is private and we couldn't set RLS policies)
        const { supabaseAdmin } = await import('@/lib/supabase');

        if (!supabaseAdmin) {
            throw new Error('Server Configuration Error: SUPABASE_SERVICE_ROLE_KEY is missing.');
        }

        const { data: uploadData, error: uploadError } = await supabaseAdmin
            .storage
            .from('backups')
            .upload(fileName, fileContent, {
                contentType: 'application/json',
                upsert: false
            });

        if (uploadError) throw uploadError;

        // 4. Log Audit
        await logAudit({
            action: 'BACKUP',
            entity: 'system',
            entityId: fileName,
            details: { size: fileContent.length, tables: tables },
            req: request
        });

        return NextResponse.json({
            success: true,
            message: 'Backup created successfully',
            file: fileName
        });

    } catch (error) {
        console.error('Backup Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
