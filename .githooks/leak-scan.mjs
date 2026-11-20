#!/usr/bin/env node
/**
 * Leak scanner for this repository's git hooks.
 *
 *   node .githooks/leak-scan.mjs staged              staged changes (pre-commit)
 *   node .githooks/leak-scan.mjs message <file>      a commit message (commit-msg)
 *   node .githooks/leak-scan.mjs push <base> <head>  every outgoing commit + the full tree (pre-push)
 *
 * Blocks credentials (Circle API key / entity secret, Gemini keys, wallet IDs, any value from
 * local .env files), recovery files, unlisted wallet addresses and 64-hex values, private
 * infrastructure, and terms listed in the untracked .git/info/leak-denylist (names, hosts,
 * attribution trailers, language that does not belong in a public repository).
 * Matched secret values are never printed.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 30 });
const root = git('rev-parse', '--show-toplevel').trim();
const gitDir = git('rev-parse', '--git-common-dir').trim();
process.chdir(root);
const lines = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n') : [])
  .map((l) => l.replace(/\s+#.*$/, '').trim()).filter((l) => l && !l.startsWith('#'));

// Public contract addresses this project uses (Arc testnet). Anything else is blocked.
const allowedAddresses = new Set(lines(path.join(root, '.githooks/allowed-addresses.txt')).map((a) => a.toLowerCase()));
// Private terms (names, hosts, IPs). Lives in .git/info, never committed.
const denylist = lines(path.resolve(gitDir, 'info/leak-denylist')).map((t) => new RegExp(t, 'i'));
// Real credential values from local env files, held in memory only.
const envValues = new Map();
for (const f of fs.readdirSync(root).filter((f) => /^\.env/.test(f) && !f.endsWith('.example'))) {
  for (const l of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*['"]?(.*?)['"]?\s*$/);
    if (m && m[2].length >= 8 && !/^(true|false|\d+|https?:\/\/(localhost|127\.0\.0\.1).*)$/i.test(m[2])) envValues.set(m[2], m[1]);
  }
}

const mask = (s) => s.slice(0, 4) + '…(' + s.length + ' chars)';
const SKIP = /(^|\/)package-lock\.json$|\.(png|jpg|jpeg|gif|ico|webp|woff2?)$/;
const DENYLIST_EXEMPT = /^LICENSE$/; // the copyright holder line

const PATHS = [
  ['env file', /(^|\/)\.env(?!\.local\.example$)[^/]*$/],
  ['key, backup or recovery file', /\.(pem|key|p12|bak|dat|sqlite3?|db)$|recovery_file/i],
  ['log or build output', /\.log$|(^|\/)(logs|\.next|node_modules|out|coverage)\//],
];
const RULES = [
  // credentials
  { id: 'Circle API key', re: new RegExp('\\b(TEST|LIVE)_API' + '_KEY:[0-9a-f]{32}:[0-9a-f]{32}\\b'), hide: true },
  { id: 'Google/Gemini API key', re: /AIza[0-9A-Za-z_-]{35}/, hide: true },
  { id: 'PEM private key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, hide: true },
  { id: '64-hex value (private key, entity secret or tx hash)', re: /(?<![0-9a-fA-F])(?:0x)?[0-9a-fA-F]{64}(?![0-9a-fA-F])/, hide: true },
  { id: 'local env value', hide: true, test: (l) => { for (const [v, k] of envValues) if (l.includes(v)) return '$' + k; } },
  // on-chain identity
  { id: 'wallet address not in .githooks/allowed-addresses.txt', re: /(?<![0-9a-fA-Fx])0x[0-9a-fA-F]{40}(?![0-9a-fA-F])/g,
    ok: (h) => allowedAddresses.has(h.toLowerCase()) || /^0x0{40}$/.test(h) },
  // infrastructure
  { id: 'private IP address', re: /(?<![\d.])(?:100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}|10\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3})\.\d{1,3}(?![\d.])/ },
  { id: 'local file path', re: /\/home\/[a-z_][\w-]*|\/Users\/[A-Za-z][\w.-]*/ },
  // people and internal context
  { id: 'private term (.git/info/leak-denylist)', test: (l, file) => { if (file && DENYLIST_EXEMPT.test(file)) return; for (const d of denylist) { const m = l.match(d); if (m) return m[0]; } } },
  { id: 'email address', re: /[\w.%+-]+@[\w-]+(?:\.[\w-]+)*\.[A-Za-z]{2,}/g, ok: (h) => /@(example\.(com|org)|users\.noreply\.github\.com)$|^noreply@/i.test(h) },
];

const findings = [];
const flag = (rule, where, value) => findings.push('  ✗ ' + rule + ': ' + where + (value ? '  ' + value : ''));

function scanLine(line, where, file) {
  for (const r of RULES) {
    const hits = r.test ? [r.test(line, file)].filter(Boolean)
      : r.re.global ? [...line.matchAll(r.re)].map((m) => m[0]) : [line.match(r.re)?.[0]].filter(Boolean);
    for (const h of hits) if (!(r.ok && r.ok(h))) flag(r.id, where, r.hide ? mask(h) : h);
  }
}
function scanPath(file, where) {
  for (const [id, re] of PATHS) if (re.test(file)) flag(id, where);
  scanLine(file, where + ' (file name)', null);
}
function scanDiff(diff, prefix) {
  let file = null, n = 0;
  for (const l of diff.split('\n')) {
    if (l.startsWith('+++ ')) { file = l.slice(6); continue; }
    if (l.startsWith('@@')) { n = +(l.match(/\+(\d+)/)?.[1] ?? 0); continue; }
    if (file && l.startsWith('+') && !SKIP.test(file)) { scanLine(l.slice(1), prefix + file + ':' + n, file); n++; }
  }
}
function scanMessage(msg, where) {
  const body = msg.replace(/^#.*$/gm, '').trim().split('\n');
  const subject = body[0] ?? '';
  const reason = body.slice(1).join(' ').split(/\s+/).filter(Boolean).length;
  if (subject.length < 10 || subject.length > 72) flag('subject must be 10-72 characters', where, subject);
  if (!/^[A-Z]/.test(subject) || /\.$/.test(subject)) flag('subject must start with a capital and not end with a period', where, subject);
  if (body.length > 1 && body[1].trim()) flag('second line must be blank', where);
  if (reason < 12) flag('body must explain why the change is needed (12+ words)', where, reason + ' words');
  msg.split('\n').forEach((l, i) => scanLine(l, where + ' message:' + (i + 1), null));
}
function scanTree(sha) {
  for (const file of git('ls-tree', '-r', '--name-only', sha).split('\n').filter(Boolean)) {
    scanPath(file, 'tree ' + file);
    if (SKIP.test(file)) continue;
    const text = git('show', sha + ':' + file);
    if (!text.includes('\0')) text.split('\n').forEach((l, i) => scanLine(l, 'tree ' + file + ':' + (i + 1), file));
  }
}

const [mode, a, b] = process.argv.slice(2);
if (mode === 'staged') {
  for (const f of git('diff', '--cached', '--name-only', '--diff-filter=ACMR').split('\n').filter(Boolean)) scanPath(f, f);
  scanDiff(git('diff', '--cached', '-U0', '--no-color', '--diff-filter=ACMR'), '');
} else if (mode === 'message') {
  scanMessage(fs.readFileSync(a, 'utf8'), 'commit');
} else if (mode === 'push') {
  for (const sha of git('rev-list', a + '..' + b).split('\n').filter(Boolean)) {
    const s = sha.slice(0, 8);
    scanMessage(git('log', '-1', '--format=%B', sha), s);
    for (const f of git('show', '--format=', '--name-only', '--diff-filter=ACMR', sha).split('\n').filter(Boolean)) scanPath(f, s + ' ' + f);
    scanDiff(git('show', '--format=', '-U0', '--no-color', '--diff-filter=ACMR', sha), s + ' ');
  }
  scanTree(b);
} else {
  console.error('usage: leak-scan.mjs staged | message <file> | push <base> <head>');
  process.exit(2);
}

const unique = [...new Set(findings)];
if (unique.length) {
  console.error(unique.join('\n') + '\n❌ leak scan (' + mode + '): ' + unique.length + ' problem(s). Fix them; never bypass with --no-verify.');
  process.exit(1);
}
console.error('✓ leak scan (' + mode + ')');
