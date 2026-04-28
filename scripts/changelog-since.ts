#!/usr/bin/env tsx
/**
 * Print Grav API plugin CHANGELOG entries newer than the version stored in
 * `.api-baseline`. After reviewing & syncing the MCP, bump `.api-baseline` to
 * the latest version reviewed. Use this to get a one-command "what's new since
 * I last looked" digest before each MCP refresh pass.
 *
 * Usage:
 *   tsx scripts/changelog-since.ts
 *   tsx scripts/changelog-since.ts --changelog /abs/path/to/CHANGELOG.md
 *   tsx scripts/changelog-since.ts --since 1.0.0-beta.10
 *   tsx scripts/changelog-since.ts --bump 1.0.0-beta.15  # update baseline
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const args = process.argv.slice(2);
function arg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}

const changelogPath = arg('--changelog')
  ?? resolve(repoRoot, '../grav-api/user/plugins/api/CHANGELOG.md');
const baselinePath = join(repoRoot, '.api-baseline');
const bumpTo = arg('--bump');
const sinceArg = arg('--since');

if (!existsSync(changelogPath)) {
  console.error(`CHANGELOG.md not found at ${changelogPath}`);
  process.exit(2);
}

const baseline = sinceArg
  ?? (existsSync(baselinePath) ? readFileSync(baselinePath, 'utf8').trim() : '');

const src = readFileSync(changelogPath, 'utf8');

// Versions look like `# v1.0.0-beta.15`. Split on those headers and keep
// the entries newer than the baseline (top-down, since the changelog is in
// reverse chronological order).
const blocks: { version: string; body: string }[] = [];
const re = /^# v([^\s]+)\s*$/gm;
let lastIdx = 0;
let lastVersion: string | null = null;
let m: RegExpExecArray | null;
while ((m = re.exec(src)) !== null) {
  if (lastVersion !== null) {
    blocks.push({ version: lastVersion, body: src.slice(lastIdx, m.index).trim() });
  }
  lastVersion = m[1];
  lastIdx = m.index;
}
if (lastVersion !== null) {
  blocks.push({ version: lastVersion, body: src.slice(lastIdx).trim() });
}

function compare(a: string, b: string): number {
  // Lexicographic on numeric-aware tokens. Works for `1.0.0-beta.15` vs `1.0.0-beta.9`.
  const aT = a.split(/[.\-]/).map((t) => /^\d+$/.test(t) ? Number(t) : t);
  const bT = b.split(/[.\-]/).map((t) => /^\d+$/.test(t) ? Number(t) : t);
  for (let i = 0; i < Math.max(aT.length, bT.length); i++) {
    const av = aT[i];
    const bv = bT[i];
    if (av === bv) continue;
    if (av === undefined) return -1;
    if (bv === undefined) return 1;
    if (typeof av === 'number' && typeof bv === 'number') return av - bv;
    return String(av).localeCompare(String(bv));
  }
  return 0;
}

if (bumpTo) {
  // Validate that the requested baseline actually exists in the changelog
  if (!blocks.some((b) => b.version === bumpTo)) {
    console.error(`Version "${bumpTo}" not found in ${changelogPath}`);
    process.exit(2);
  }
  writeFileSync(baselinePath, bumpTo + '\n');
  console.log(`Baseline updated to ${bumpTo}`);
  process.exit(0);
}

const newer = baseline
  ? blocks.filter((b) => compare(b.version, baseline) > 0)
  : blocks;

if (!newer.length) {
  console.log(baseline
    ? `No new versions since baseline ${baseline}.`
    : 'CHANGELOG.md has no version blocks.');
  process.exit(0);
}

console.log(baseline
  ? `# Changes since ${baseline} (${newer.length} version${newer.length === 1 ? '' : 's'})\n`
  : `# All ${newer.length} version${newer.length === 1 ? '' : 's'}\n`);
for (const b of newer) {
  console.log(b.body);
  console.log('');
}
console.log('---');
console.log(`When done reviewing, run: npm run changelog:since -- --bump ${newer[0].version}`);
