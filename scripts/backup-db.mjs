/**
 * backup-db.mjs
 * تصدير نسخة احتياطية كاملة من Supabase عبر REST API
 * ورفعها تلقائياً إلى Supabase Storage (bucket: backups)
 *
 * الاستخدام:
 *   node scripts/backup-db.mjs           ← نسخ + رفع
 *   node scripts/backup-db.mjs --local   ← نسخ محلي فقط بدون رفع
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ─── إعداد المتغيرات ─────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// قراءة .env يدويًا (بدون dotenv)
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

const env = loadEnv();
const SUPABASE_URL   = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY    = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL أو SUPABASE_SERVICE_ROLE_KEY غير موجود في .env');
  process.exit(1);
}

const HOST       = new URL(SUPABASE_URL).hostname;
const PAGE_SIZE  = 1000;
const BUCKET     = 'backups';
const KEEP_DAYS  = 30; // احتفظ بالنسخ لآخر 30 يوم
const LOCAL_ONLY = process.argv.includes('--local');

// ─── دوال مساعدة ────────────────────────────────────────────────────────────
function httpsGet(urlPath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HOST,
      path: urlPath,
      method: 'GET',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': 'Bearer ' + SERVICE_KEY,
        'Accept': 'application/json',
        'Prefer': 'count=exact',
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function fetchAllRows(table) {
  const rows = [];
  let offset = 0;

  while (true) {
    const urlPath = `/rest/v1/${table}?select=*&limit=${PAGE_SIZE}&offset=${offset}&order=id.asc`;
    const res = await httpsGet(urlPath);

    if (res.status === 404) {
      // الجدول غير موجود أو لا يحتوي على عمود id
      const urlPath2 = `/rest/v1/${table}?select=*&limit=${PAGE_SIZE}&offset=${offset}`;
      const res2 = await httpsGet(urlPath2);
      if (res2.status !== 200) break;
      const batch = JSON.parse(res2.body);
      if (!Array.isArray(batch) || batch.length === 0) break;
      rows.push(...batch);
      if (batch.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
      continue;
    }

    if (res.status !== 200) {
      console.warn(`  ⚠️  ${table}: HTTP ${res.status} - ${res.body.substring(0, 100)}`);
      break;
    }

    const batch = JSON.parse(res.body);
    if (!Array.isArray(batch) || batch.length === 0) break;
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return rows;
}

// جلب قائمة الجداول من Swagger
async function getTableNames() {
  const res = await httpsGet('/rest/v1/');
  if (res.status !== 200) throw new Error('فشل جلب schema: ' + res.status);
  const swagger = JSON.parse(res.body);
  return Object.keys(swagger.paths || {})
    .map(p => p.replace(/^\//, ''))
    .filter(t => t && !t.startsWith('rpc/'));
}

// ─── رفع ملف إلى Supabase Storage ───────────────────────────────────────────
function httpsUpload(storagePath, fileBuffer, contentType) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HOST,
      path: `/storage/v1/object/${BUCKET}/${storagePath}`,
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': 'Bearer ' + SERVICE_KEY,
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length,
        'x-upsert': 'true', // استبدال إذا وُجد
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(fileBuffer);
    req.end();
  });
}

// جلب قائمة ملفات bucket لحذف القديمة
function httpsPostJson(urlPath, body) {
  return new Promise((resolve, reject) => {
    const payload = Buffer.from(JSON.stringify(body), 'utf8');
    const options = {
      hostname: HOST,
      path: urlPath,
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': 'Bearer ' + SERVICE_KEY,
        'Content-Type': 'application/json',
        'Content-Length': payload.length,
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function deleteStorageObjects(paths) {
  if (paths.length === 0) return;
  const res = await httpsPostJson(`/storage/v1/object/bulk-delete`, { prefixes: paths });
  return res;
}

async function pruneOldBackups() {
  // جلب قائمة الملفات
  const res = await httpsPostJson(`/storage/v1/object/list/${BUCKET}`, {
    prefix: '',
    limit: 500,
    offset: 0,
    sortBy: { column: 'created_at', order: 'asc' },
  });
  if (res.status !== 200) return;

  const files = JSON.parse(res.body);
  if (!Array.isArray(files)) return;

  const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
  const toDelete = files
    .filter(f => f.name && new Date(f.created_at).getTime() < cutoff)
    .map(f => `${f.name}`);

  if (toDelete.length > 0) {
    await deleteStorageObjects(toDelete);
    console.log(`🗑️  حُذفت ${toDelete.length} نسخة قديمة (أكثر من ${KEEP_DAYS} يوم)`);
  }
}

// ─── البرنامج الرئيسي ────────────────────────────────────────────────────────
async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const backupDir = path.join(ROOT, 'backups');
  const backupFile = path.join(backupDir, `backup_${timestamp}.json`);
  const schemaFile = path.join(backupDir, `schema_${timestamp}.json`);

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  console.log('🔄 بدء النسخ الاحتياطي من:', SUPABASE_URL);
  console.log('📁 ملف الحفظ:', backupFile);
  console.log('');

  // جلب قائمة الجداول
  console.log('📋 جلب قائمة الجداول...');
  const tables = await getTableNames();
  console.log(`   وجدت ${tables.length} جداول: ${tables.join(', ')}\n`);

  // تصدير كل جدول
  const backup = {
    metadata: {
      exported_at: new Date().toISOString(),
      supabase_url: SUPABASE_URL,
      project_ref: HOST.split('.')[0],
      tables: tables,
      version: '1.0.0',
    },
    data: {},
    row_counts: {},
  };

  for (const table of tables) {
    process.stdout.write(`   📥 ${table}... `);
    try {
      const rows = await fetchAllRows(table);
      backup.data[table] = rows;
      backup.row_counts[table] = rows.length;
      console.log(`${rows.length} صف`);
    } catch (err) {
      console.log(`❌ خطأ: ${err.message}`);
      backup.data[table] = [];
      backup.row_counts[table] = 0;
    }
  }

  // حفظ البيانات محلياً
  fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2), 'utf8');

  // حفظ الـ schema بشكل منفصل
  const schemaRes = await httpsGet('/rest/v1/');
  const swaggerSchema = JSON.parse(schemaRes.body);
  fs.writeFileSync(schemaFile, JSON.stringify(swaggerSchema, null, 2), 'utf8');

  // ملخص
  const totalRows = Object.values(backup.row_counts).reduce((a, b) => a + b, 0);
  const fileSizeKB = Math.round(fs.statSync(backupFile).size / 1024);
  const schemaSizeKB = Math.round(fs.statSync(schemaFile).size / 1024);

  console.log('\n✅ اكتمل النسخ الاحتياطي!');
  console.log('─'.repeat(50));
  console.log(`📊 إجمالي الصفوف : ${totalRows.toLocaleString()}`);
  console.log(`📁 ملف البيانات  : backup_${timestamp}.json (${fileSizeKB} KB)`);
  console.log(`📋 ملف الـ Schema : schema_${timestamp}.json (${schemaSizeKB} KB)`);
  console.log('\nتوزيع الصفوف لكل جدول:');
  for (const [t, c] of Object.entries(backup.row_counts)) {
    if (c > 0) console.log(`  ${t.padEnd(30)} ${c.toString().padStart(6)} صف`);
  }

  // ─── رفع إلى Supabase Storage ────────────────────────────────────────────
  if (!LOCAL_ONLY) {
    console.log('\n☁️  رفع إلى Supabase Storage...');

    const backupBuf = fs.readFileSync(backupFile);
    const schemaBuf = fs.readFileSync(schemaFile);

    const backupStoragePath = `data/backup_${timestamp}.json`;
    const schemaStoragePath = `schema/schema_${timestamp}.json`;

    const [upData, upSchema] = await Promise.all([
      httpsUpload(backupStoragePath, backupBuf, 'application/json'),
      httpsUpload(schemaStoragePath, schemaBuf, 'application/json'),
    ]);

    if (upData.status === 200 || upData.status === 201) {
      console.log(`  ✅ بيانات  → storage://${BUCKET}/${backupStoragePath}`);
    } else {
      console.warn(`  ⚠️  فشل رفع البيانات: HTTP ${upData.status} - ${upData.body.substring(0, 120)}`);
    }

    if (upSchema.status === 200 || upSchema.status === 201) {
      console.log(`  ✅ schema  → storage://${BUCKET}/${schemaStoragePath}`);
    } else {
      console.warn(`  ⚠️  فشل رفع الـ schema: HTTP ${upSchema.status} - ${upSchema.body.substring(0, 120)}`);
    }

    // حذف النسخ الأقدم من KEEP_DAYS يوم
    console.log(`\n🧹 تنظيف النسخ الأقدم من ${KEEP_DAYS} يوم...`);
    await pruneOldBackups();

    console.log('\n🎉 تم الحفظ محلياً ورفعه إلى Supabase Storage!');
  } else {
    console.log('\n📌 وضع --local: تم الحفظ محلياً فقط.');
  }
}

main().catch(err => {
  console.error('\n❌ خطأ عام:', err.message);
  process.exit(1);
});
