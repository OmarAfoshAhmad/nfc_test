import { mkdirSync, copyFileSync, existsSync, writeFileSync, cpSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const dotenvCandidates = ['.env', '.env.local', '.env.production'];
for (const candidate of dotenvCandidates) {
  const filePath = join(rootDir, candidate);
  if (existsSync(filePath)) {
    dotenv.config({ path: filePath, override: false });
  }
}

const args = process.argv.slice(2);
const flag = (name) => {
  const idx = args.findIndex((a) => a === `--${name}`);
  if (idx === -1) return undefined;
  return args[idx + 1];
};

const envOrFlag = (flagName, envName) => {
  const value = flag(flagName) || process.env[envName];
  if (!value) {
    console.error(`Missing required value: --${flagName} or env ${envName}`);
    process.exit(1);
  }
  return value;
};

const target = envOrFlag('target', 'BRIDGE_TARGET');
const supabaseUrl = envOrFlag('supabase-url', 'SUPABASE_URL');
const supabaseKey = envOrFlag('supabase-key', 'SUPABASE_SERVICE_ROLE_KEY');
const yamenSecret = envOrFlag('yamen-secret', 'YAMEN_SECRET');

const outBase = join(rootDir, 'dist-bin');
mkdirSync(outBase, { recursive: true });

const bundleDir = join(outBase, `bundle-${target}`);
mkdirSync(bundleDir, { recursive: true });

const bundleOutfile = join(bundleDir, 'index.js');

const isNodeModulesTarget = target.startsWith('node');
if (!isNodeModulesTarget) {
  console.error('Target must be a pkg target like node20-win-x64, node20-macos-x64, node20-macos-arm64');
  process.exit(1);
}

const escapeForJs = (value) => JSON.stringify(String(value));
const quoteArg = (value) => `"${String(value).replace(/"/g, '\\"')}"`;
const runCommand = (command, title) => {
  const result = spawnSync(command, {
    cwd: rootDir,
    shell: true,
    stdio: 'pipe',
    encoding: 'utf8',
    env: process.env
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.error) {
    console.error(`\n${title} failed: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`\n${title} failed with exit code ${result.status}`);
    process.exit(result.status || 1);
  }
};

console.log(`Building bridge bundle for target: ${target}`);

const esbuildArgs = [
  '--yes',
  'esbuild',
  join(rootDir, 'scripts', 'nfc-bridge-pkg.js'),
  '--bundle',
  '--platform=node',
  `--outfile=${bundleOutfile}`,
  '--external:nfc-pcsc',
  '--external:node-notifier',
  '--external:bindings',
  `--define:__EMBED_SUPABASE_URL__=${escapeForJs(supabaseUrl)}`,
  `--define:__EMBED_SUPABASE_KEY__=${escapeForJs(supabaseKey)}`,
  `--define:__EMBED_YAMEN_SECRET__=${escapeForJs(yamenSecret)}`
];

runCommand(`npx ${esbuildArgs.map(quoteArg).join(' ')}`, 'esbuild step');

// Prevent pkg static analysis warning for optional runtime config file.
// Embedded credentials are used in packaged builds, so this placeholder is never required at runtime.
writeFileSync(
  join(bundleDir, 'bridge-config.json'),
  JSON.stringify({
    supabaseUrl: 'embedded-at-build-time',
    supabaseKey: 'embedded-at-build-time',
    yamenSecret: 'embedded-at-build-time'
  }, null, 2)
);

const copiedNativeModulesDir = join(bundleDir, 'node_modules');
mkdirSync(copiedNativeModulesDir, { recursive: true });

// Ensure required native bindings are present next to executable runtime.
const nativeFiles = [
  join(rootDir, 'node_modules', '@pokusew', 'pcsclite', 'build', 'Release', 'pcsclite.node'),
  join(rootDir, 'node_modules', 'bindings', 'bindings.js')
];

for (const src of nativeFiles) {
  if (!existsSync(src)) {
    console.warn(`Warning: optional native file not found, skipping: ${src}`);
    continue;
  }
  const rel = src.substring(rootDir.length + 1);
  const dst = join(bundleDir, rel);
  mkdirSync(dirname(dst), { recursive: true });
  copyFileSync(src, dst);
}

const exeName = target.includes('win')
  ? 'nfc-bridge.exe'
  : 'nfc-bridge';

const outPath = join(outBase, `${basename(target)}-${exeName}`);

const pkgArgs = [
  '--yes',
  '@yao-pkg/pkg',
  bundleOutfile,
  '--target', target,
  '--output', outPath
];

console.log(`Packaging single executable -> ${outPath}`);
runCommand(`npx ${pkgArgs.map(quoteArg).join(' ')}`, 'pkg step');

// Build a portable runtime folder so native modules are resolvable next to the executable.
const runtimeDir = join(outBase, `${basename(target)}-runtime`);
mkdirSync(runtimeDir, { recursive: true });

const runtimeExePath = join(runtimeDir, exeName);
copyFileSync(outPath, runtimeExePath);

const runtimeModules = [
  join(rootDir, 'node_modules', 'nfc-pcsc'),
  join(rootDir, 'node_modules', 'node-notifier'),
  join(rootDir, 'node_modules', '@pokusew', 'pcsclite'),
  join(rootDir, 'node_modules', 'bindings'),
  join(rootDir, 'node_modules', 'nan'),
  join(rootDir, 'node_modules', 'file-uri-to-path')
];

for (const src of runtimeModules) {
  if (!existsSync(src)) {
    console.warn(`Warning: runtime module not found, skipping: ${src}`);
    continue;
  }
  const rel = src.substring(rootDir.length + 1);
  const dst = join(runtimeDir, rel);
  mkdirSync(dirname(dst), { recursive: true });
  cpSync(src, dst, { recursive: true });
}

// Provide default terminal config in the portable folder for first run.
writeFileSync(
  join(runtimeDir, 'TERMINAL_CONFIGE.json'),
  JSON.stringify({
    terminalId: 1,
    terminalName: 'Scanner-01'
  }, null, 2)
);

console.log('\nBuild completed. Output:');
console.log(outPath);
console.log(`Portable runtime folder: ${runtimeDir}`);
console.log('\nRuntime behavior:');
console.log('- Credentials are embedded in executable (not prompted / not in external file).');
console.log('- Terminal config is loaded from TERMINAL_CONFIGE.json next to executable.');
console.log('- If config file does not exist, the app will create it interactively.');
