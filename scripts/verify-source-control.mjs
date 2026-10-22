import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';

// Inspect the staged bytes, and report paths only, never secret values.
const files = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']).toString().split('\0').filter(Boolean);
assert.ok(files.length, 'Stage the files to audit first.');
const secrets = new Set();
for (const name of ['.env', '.env.cloud']) {
  if (!fs.existsSync(name)) continue;
  for (const [key, value] of Object.entries(dotenv.parse(fs.readFileSync(name)))) {
    if (/PASSWORD|SECRET|TOKEN|DATABASE_URL|SERVICE.*KEY/i.test(key) && value.length >= 8) secrets.add(value);
  }
}
for (const name of fs.readdirSync('.').filter(name => /credentials.*\.txt$/i.test(name))) {
  for (const match of fs.readFileSync(name, 'utf8').matchAll(/^Password:\s*(.+)$/gm)) {
    const value = match[1].trim();
    if (value.length >= 8) secrets.add(value);
  }
}
const violations = [];
for (const name of files) {
  if (/^(data|tmp|test-data|node_modules|dist|\.wrangler|\.agents|\.codex|presentations|attached_assets)\//i.test(name)
    || /^\.env($|\.)/.test(name) && !['.env.example', '.env.cloud.example'].includes(name)
    || /credentials.*\.(txt|json)$/i.test(name)
    || /\.(pem|key|p12|pfx|log)$/i.test(name)
    || name.startsWith('supabase/.temp/')) violations.push(name + ': private/local artifact');
  const content = execFileSync('git', ['show', ':' + name], { maxBuffer: 20 * 1024 * 1024 });
  if ([...secrets].some(value => content.includes(Buffer.from(value)))) violations.push(name + ': configured credential value');
  if (/\bgh[pousr]_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content.toString())) violations.push(name + ': embedded credential');
}
assert.equal(violations.length, 0, 'Source-control audit failed:\n' + violations.join('\n'));
console.log(`PASS: ${files.length} staged files contain no configured credentials or excluded private artifacts.`);
