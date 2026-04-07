/**
 * restore-db.mjs
 * Restore a JSON backup file into Supabase via REST API.
 *
 * Usage:
 *   npm run restore -- --file backups/backup_2026-03-25_00-18-15.json
 *   npm run restore -- --file backups/backup_2026-03-25_00-18-15.json --dry-run
 *
 * Optional:
 *   --chunk 500
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error('.env file not found at ' + envPath);
  }

  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  const env = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    env[key] = val;
  }

  return env;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = {
    file: null,
    dryRun: false,
    chunk: 500,
  };

  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--file') out.file = args[i + 1];
    if (a === '--dry-run') out.dryRun = true;
    if (a === '--chunk') out.chunk = Number(args[i + 1]) || 500;
  }

  return out;
}

function requestJson({ hostname, method, urlPath, headers, body }) {
  return new Promise((resolve, reject) => {
    const payload = body ? Buffer.from(JSON.stringify(body), 'utf8') : null;

    const options = {
      hostname,
      path: urlPath,
      method,
      headers: {
        ...(headers || {}),
        ...(payload
          ? {
              'Content-Type': 'application/json',
              'Content-Length': payload.length,
            }
          : {}),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data });
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function chunkRows(rows, size) {
  const chunks = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
}

function resolveBackupData(raw) {
  if (raw && raw.data && typeof raw.data === 'object') return raw.data;

  const out = {};
  for (const [k, v] of Object.entries(raw || {})) {
    if (['meta', 'metadata', 'row_counts'].includes(k)) continue;
    if (Array.isArray(v)) out[k] = v;
  }
  return out;
}

function getRestoreOrder(tableNames) {
  const preferred = [
    'settings',
    'branches',
    'users',
    'customers',
    'cards',
    'campaigns',
    'discounts',
    'terminals',
    'transactions',
    'customer_coupons',
    'customer_campaign_progress',
    'balance_ledger',
    'scan_events',
    'terminal_actions',
    'audit_logs',
  ];

  const inBackup = new Set(tableNames);
  const ordered = preferred.filter((t) => inBackup.has(t));
  const rest = tableNames.filter((t) => !ordered.includes(t)).sort();
  return [...ordered, ...rest];
}

function conflictColumnsFor(table) {
  if (table === 'settings') return 'key_name';
  return 'id';
}

async function upsertTable({ hostname, serviceKey, table, rows, chunkSize, dryRun }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    console.log(`  - ${table}: 0 rows (skip)`);
    return { ok: true, count: 0 };
  }

  if (dryRun) {
    console.log(`  - ${table}: ${rows.length} rows (dry-run)`);
    return { ok: true, count: rows.length };
  }

  const chunks = chunkRows(rows, chunkSize);
  const conflict = conflictColumnsFor(table);
  let inserted = 0;

  for (let i = 0; i < chunks.length; i += 1) {
    const batch = chunks[i];
    const pathWithConflict = `/rest/v1/${table}?on_conflict=${encodeURIComponent(conflict)}`;

    const res = await requestJson({
      hostname,
      method: 'POST',
      urlPath: pathWithConflict,
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: batch,
    });

    if (res.status >= 200 && res.status < 300) {
      inserted += batch.length;
      continue;
    }

    // Fallback insert without on_conflict for tables without expected key.
    const fallback = await requestJson({
      hostname,
      method: 'POST',
      urlPath: `/rest/v1/${table}`,
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: 'return=minimal',
      },
      body: batch,
    });

    if (!(fallback.status >= 200 && fallback.status < 300)) {
      return {
        ok: false,
        count: inserted,
        error: `HTTP ${fallback.status}: ${fallback.body?.slice(0, 300) || 'unknown error'}`,
      };
    }

    inserted += batch.length;
  }

  console.log(`  - ${table}: ${inserted} rows restored`);
  return { ok: true, count: inserted };
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.file) {
    console.error('Missing required --file argument');
    process.exit(1);
  }

  const env = loadEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }

  const filePath = path.isAbsolute(args.file) ? args.file : path.join(ROOT, args.file);
  if (!fs.existsSync(filePath)) {
    console.error(`Backup file not found: ${filePath}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const data = resolveBackupData(raw);
  const tables = getRestoreOrder(Object.keys(data));

  const hostname = new URL(supabaseUrl).hostname;

  console.log(`Restoring from file: ${filePath}`);
  console.log(`Supabase host: ${hostname}`);
  console.log(`Mode: ${args.dryRun ? 'dry-run' : 'apply'}`);
  console.log(`Tables: ${tables.join(', ')}`);

  let total = 0;
  const failures = [];

  for (const table of tables) {
    const result = await upsertTable({
      hostname,
      serviceKey,
      table,
      rows: data[table],
      chunkSize: Math.max(1, args.chunk),
      dryRun: args.dryRun,
    });

    total += result.count || 0;
    if (!result.ok) {
      failures.push({ table, error: result.error || 'unknown error' });
      console.error(`  x ${table}: ${result.error}`);
    }
  }

  console.log('----------------------------------------');
  console.log(`Rows processed: ${total}`);

  if (failures.length > 0) {
    console.log('Failed tables:');
    for (const f of failures) {
      console.log(`  - ${f.table}: ${f.error}`);
    }
    process.exit(1);
  }

  console.log(args.dryRun ? 'Dry-run completed.' : 'Restore completed successfully.');
}

main().catch((err) => {
  console.error('Restore failed:', err.message || err);
  process.exit(1);
});
