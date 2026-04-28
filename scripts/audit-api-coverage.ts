#!/usr/bin/env tsx
/**
 * Audit API coverage for grav-mcp.
 *
 * Compares the routes registered in the Grav API plugin (ApiRouter.php — the
 * runtime source of truth) against `// @api METHOD /path` annotations in
 * src/tools/. Reports three buckets and exits non-zero on drift so this can
 * gate CI.
 *
 * Usage:
 *   tsx scripts/audit-api-coverage.ts
 *   tsx scripts/audit-api-coverage.ts --router /abs/path/to/ApiRouter.php
 *   tsx scripts/audit-api-coverage.ts --tools /abs/path/to/src/tools
 *   tsx scripts/audit-api-coverage.ts --json
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface Endpoint {
  method: string;
  path: string;
}

interface ToolHit extends Endpoint {
  file: string;
  line: number;
}

const args = process.argv.slice(2);
function arg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}
const jsonOutput = args.includes('--json');

const repoRoot = resolve(__dirname, '..');
const defaultRouter = resolve(
  repoRoot,
  '../grav-api/user/plugins/api/classes/Api/ApiRouter.php',
);
const routerPath = arg('--router') ?? defaultRouter;
const toolsDir = arg('--tools') ?? join(repoRoot, 'src/tools');
const ignorePath = join(repoRoot, '.audit-ignore');

if (!existsSync(routerPath)) {
  console.error(`ApiRouter.php not found at ${routerPath}`);
  console.error('Pass --router /abs/path/to/ApiRouter.php to override.');
  process.exit(2);
}

const ignored = new Set<string>();
if (existsSync(ignorePath)) {
  for (const line of readFileSync(ignorePath, 'utf8').split('\n')) {
    const trimmed = line.split('#')[0].trim();
    if (trimmed) ignored.add(normalize(trimmed));
  }
}

function normalize(key: string): string {
  // Lowercase method, strip trailing slash, strip FastRoute regex constraints
  // (`{route:.+}` → `{route}`).
  const [methodRaw, ...rest] = key.split(/\s+/);
  const path = rest.join(' ').replace(/\{(\w+):[^}]+\}/g, '{$1}').replace(/\/+$/, '') || '/';
  return `${methodRaw.toUpperCase()} ${path}`;
}

function parseRouter(file: string): Endpoint[] {
  const src = readFileSync(file, 'utf8');
  const re = /\$r->addRoute\(\s*'([A-Z]+)'\s*,\s*'([^']+)'/g;
  const out: Endpoint[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    out.push({ method: m[1], path: m[2] });
  }
  return out;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (entry.endsWith('.ts')) out.push(p);
  }
  return out;
}

function parseTools(dir: string): ToolHit[] {
  const re = /\/\/\s*@api\s+([A-Z]+)\s+(\S+)/g;
  const out: ToolHit[] = [];
  for (const file of walk(dir)) {
    const src = readFileSync(file, 'utf8');
    const lines = src.split('\n');
    lines.forEach((line, i) => {
      const m = re.exec(line);
      re.lastIndex = 0;
      if (m) out.push({ method: m[1], path: m[2], file, line: i + 1 });
    });
  }
  return out;
}

const routerEndpoints = parseRouter(routerPath);
const toolHits = parseTools(toolsDir);

const apiKeys = new Set(routerEndpoints.map((e) => normalize(`${e.method} ${e.path}`)));
const mcpKeys = new Set(toolHits.map((t) => normalize(`${t.method} ${t.path}`)));

const apiOnly = [...apiKeys].filter((k) => !mcpKeys.has(k) && !ignored.has(k)).sort();
const mcpOnly = [...mcpKeys].filter((k) => !apiKeys.has(k) && !ignored.has(k)).sort();
const covered = [...apiKeys].filter((k) => mcpKeys.has(k)).sort();

if (jsonOutput) {
  process.stdout.write(JSON.stringify({ covered, apiOnly, mcpOnly, ignored: [...ignored] }, null, 2) + '\n');
} else {
  const total = apiKeys.size;
  console.log(`grav-mcp API coverage`);
  console.log(`  router:  ${routerPath}`);
  console.log(`  tools:   ${toolsDir}`);
  console.log('');
  console.log(`  ${covered.length}/${total} routes covered`);
  if (ignored.size) console.log(`  ${ignored.size} ignored (.audit-ignore)`);
  console.log('');

  if (apiOnly.length) {
    console.log(`API-only — endpoints with no MCP tool (${apiOnly.length}):`);
    for (const k of apiOnly) console.log(`  - ${k}`);
    console.log('');
  }

  if (mcpOnly.length) {
    console.log(`MCP-only — annotated tools with no matching route (${mcpOnly.length}):`);
    for (const k of mcpOnly) console.log(`  - ${k}`);
    console.log('  (Either the route was renamed/removed, or the @api annotation is wrong.)');
    console.log('');
  }

  if (!apiOnly.length && !mcpOnly.length) {
    console.log('✓ No drift detected.');
  }
}

process.exit(apiOnly.length || mcpOnly.length ? 1 : 0);
