// Bundles the real API handlers with fakes for Stripe, Resend and Supabase, then runs the
// order flow tests. Usage: node tests/order-flow/run.mjs
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const fakes = join(here, 'fakes');
const out = mkdtempSync(join(tmpdir(), 'order-flow-'));

const aliases = {
  stripe: 'stripe.cjs',
  resend: 'resend.mjs',
  micro: 'micro.mjs',
  '@supabase/supabase-js': 'supabase.mjs',
  '@prisma/client': 'noop.mjs',
  '@prisma/adapter-pg': 'noop.mjs',
  pg: 'noop.mjs',
};

const entries = {
  webhook: 'pages/api/webhooks/stripe.js',
  bySession: 'pages/api/order/by-session.js',
  retiredWebhook: 'pages/api/stripe/webhook.js',
};

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
for (const [name, entry] of Object.entries(entries)) {
  const args = [
    '--yes', 'esbuild@0.25.0', entry,
    '--bundle', '--platform=node', '--format=esm', '--log-level=warning',
    `--outfile=${join(out, `${name}.mjs`)}`,
    ...Object.entries(aliases).map(([from, to]) => `--alias:${from}=${join(fakes, to)}`),
  ];
  const result = spawnSync(npx, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const result = spawnSync(process.execPath, [join(here, 'order-flow.test.mjs')], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, ORDER_FLOW_BUILD: out },
});
process.exit(result.status ?? 1);
