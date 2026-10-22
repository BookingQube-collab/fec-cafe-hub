/**
 * Enable/disable Arena for every restaurant that has at least one menu category.
 * Same as: npx tsx scripts/enable-arena.ts --all [on|off]
 *
 * Default: local PGlite. Cloud: ALLOW_CLOUD_ARENA=1
 */
import { spawnSync } from 'node:child_process';

const mode = (process.argv[2] || 'on').toLowerCase();
if (!['on', 'off'].includes(mode)) {
  console.error('Usage: npx tsx scripts/enable-arena-all.ts [on|off]');
  process.exit(1);
}

const result = spawnSync('npx', ['tsx', 'scripts/enable-arena.ts', '--all', mode], {
  stdio: 'inherit',
  env: process.env,
  shell: true,
  cwd: process.cwd(),
});
process.exit(result.status ?? 1);
