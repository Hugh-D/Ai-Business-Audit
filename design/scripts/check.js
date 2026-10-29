#!/usr/bin/env node
// Brand QA. Two checks, both read design/tokens/volve.tokens.json:
//   1. Contrast: every approved text/surface pairing meets WCAG AA.
//   2. Palette: no hex colour outside the tokens in the given files or folders.
//
//   node design/scripts/check.js                       (checks design/templates + tokens)
//   node design/scripts/check.js path/to/file.css dir/ (checks those instead)
//   node design/scripts/check.js --report ai-audit-system/public   (lists strays, never fails)
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const tokens = JSON.parse(fs.readFileSync(path.join(REPO, 'design', 'tokens', 'volve.tokens.json'), 'utf8'));
const col = Object.fromEntries(Object.entries(tokens.color).filter(([, n]) => n.$value).map(([k, n]) => [k, n.$value]));
const tint = Object.fromEntries(Object.entries(tokens.tint).filter(([, n]) => n.$value).map(([k, n]) => [k, n.$value]));

// ---------- 1. Contrast ----------
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

// [foreground, background, minimum, what it is used for]
const PAIRS = [
  ['paper', 'espresso', 4.5, 'body text on dark'],
  ['text-secondary-on-dark', 'espresso', 4.5, 'supporting text on dark'],
  ['gold', 'espresso', 4.5, 'accent text and eyebrows on dark'],
  ['espresso', 'paper', 4.5, 'body text on light'],
  ['espresso', 'white', 4.5, 'body text in cards'],
  ['slate', 'paper', 4.5, 'secondary text on light'],
  ['slate', 'white', 4.5, 'secondary text in cards'],
  ['ochre', 'paper', 3.0, 'accent on light, 24px+ only'],
  ['paper', 'ochre', 3.0, 'primary button label, 19px bold+ only'],
  ['espresso', 'gold', 4.5, 'all text on Signal'],
  ['paper', 'slate', 4.5, 'text on slate card headers'],
  ['alert', 'alert-wash', 4.5, 'FIX FIRST pill'],
  ['espresso', 'gold-wash', 4.5, 'WATCH pill'],
  ['alert', 'white', 4.5, 'alert text in reports'],
];
const hex = (name) => col[name] || tint[name];
let failed = 0;
const report = process.argv.includes('--report');
if (!report) {
  console.log('Contrast (WCAG 2.1 AA)');
  for (const [fg, bg, min, use] of PAIRS) {
    const r = ratio(hex(fg), hex(bg));
    const ok = r >= min;
    if (!ok) failed++;
    console.log(`  ${ok ? 'pass' : 'FAIL'}  ${r.toFixed(2).padStart(5)}:1  ${fg} on ${bg}  (${use}, needs ${min})`);
  }
}

// ---------- 2. Palette ----------
const allowed = new Set([...Object.values(col), ...Object.values(tint)].map((h) => h.toUpperCase()));
const norm = (h) => { h = h.toUpperCase(); return h.length === 4 ? '#' + [...h.slice(1)].map((c) => c + c).join('') : h; };
const files = (p) => {
  const abs = path.resolve(REPO, p);
  if (!fs.existsSync(abs)) return [];
  if (fs.statSync(abs).isFile()) return [abs];
  return fs.readdirSync(abs).flatMap((f) => (f === 'node_modules' || f === 'out' ? [] : files(path.join(abs, f))))
    .filter((f) => /\.(css|html|js|svg|json|py)$/.test(f));
};
const targets = process.argv.slice(2).filter((a) => a !== '--report');
const scan = (targets.length ? targets : ['design/templates', 'design/tokens/volve.css', 'design/logo']).flatMap(files);
const strays = {};
for (const f of scan) {
  fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    if (/mask-image/.test(line)) return; // masks use black purely as alpha
    for (const m of line.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)) {
      if (!allowed.has(norm(m[0]))) (strays[norm(m[0])] ||= []).push(`${path.relative(REPO, f)}:${i + 1}`);
    }
  });
}
const strayCount = Object.keys(strays).length;
console.log(`\nPalette: ${scan.length} files scanned, ${strayCount} off-palette colour${strayCount === 1 ? '' : 's'}`);
for (const [h, where] of Object.entries(strays).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${h}  x${where.length}  ${where.slice(0, 3).join(', ')}${where.length > 3 ? ', ...' : ''}`);
}
if (!report && (failed || strayCount)) process.exitCode = 1;
