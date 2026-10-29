#!/usr/bin/env node
// Renders Volve Solutions social posts from JSON specs to PNG.
//
//   node design/templates/social/render.js design/templates/social/posts/busy-signal.json
//   node design/templates/social/render.js --all                 (every spec in posts/)
//   node design/templates/social/render.js --all --out some/dir  (default out: design/templates/social/out)
//   node design/templates/social/render.js --logos               (PNG exports of design/logo/*.svg)
//
// Spec reference: design/templates/social/README.md
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');

const REPO = path.resolve(__dirname, '..', '..', '..');
const DESIGN = path.join(REPO, 'design');
const tokens = JSON.parse(fs.readFileSync(path.join(DESIGN, 'tokens', 'volve.tokens.json'), 'utf8'));

const FORMATS = { '4x5': [1080, 1350], '1x1': [1080, 1080], '9x16': [1080, 1920] };
const fileUrl = (p) => 'file://' + path.resolve(REPO, p);
const LOCKUP = {
  dark: fileUrl('design/logo/volve-lockup-on-dark.svg'),
  light: fileUrl('design/logo/volve-lockup-on-light.svg'),
  signal: fileUrl('design/logo/volve-lockup-on-gold.svg'),
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// *words* = italic accent (gold on dark, ochre on light). [words] = knockout block (Signal only).
const markup = (s) => esc(s).replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/\[(.+?)\]/g, '<span class="knock">$1</span>');

function headline(spec, defaultSize) {
  const size = spec.size || defaultSize;
  const lines = spec.headline.map((l) => `<span class="line"><span class="lt">${markup(l)}</span></span>`).join('');
  return `<h1 class="headline fit size-${size}">${lines}</h1>`;
}

function callbar(spec, banded) {
  const phone = tokens.contact[`phone-${spec.phone || 'business-check'}`];
  return `
  <footer class="callbar pad${banded ? ' banded' : ''}">
    <div class="cb-top"><span class="eyebrow">${esc(spec.eyebrow || tokens.contact.offer.$value)}</span><img class="lockup" src="${LOCKUP.dark}" alt=""></div>
    <div class="phone fit-phone"><span class="lt">${esc(phone.display)}</span></div>
    <div class="cb-foot"><span>${esc(spec.footer || tokens.contact['cta-footer'].$value)}</span><span>${esc(tokens.contact.web.$value)}</span></div>
  </footer>`;
}

function card(c) {
  if (!c) return '<div class="spacer"></div>';
  if (c.kind === 'paper') {
    const rows = c.rows.map((r) => `
      <div class="row"><div><div class="r-title">${esc(r.title)}</div><div class="r-sub">${esc(r.sub || '')}</div></div>
      <span class="stamp${r.ink ? ' ink' : ''}" style="transform:rotate(${r.tilt || 0}deg)">${esc(r.stamp)}</span></div>`).join('');
    return `<div class="card-wrap pad"><div class="paper-card"><div class="pc-head"><span class="pc-title">${esc(c.title)}</span><span class="pc-meta">${esc(c.meta || '')}</span></div>${rows}</div></div>`;
  }
  if (c.kind === 'check') {
    const label = { 'fix-first': 'Fix first', watch: 'Watch', 'on-track': 'On track' };
    const rows = c.rows.map((r, i) => `
      <div class="row"><span class="num">${i + 1}</span><span class="r-title">${esc(r.title)}</span><span class="pill ${r.status}">${label[r.status]}</span></div>`).join('');
    const rv = c.reviewer;
    const foot = rv ? `<div class="cc-foot"><img src="${fileUrl(rv.photo)}" alt=""><span><b>Reviewed personally by ${esc(rv.name)}.</b> ${esc(rv.note || '')}</span></div>` : '';
    return `<div class="card-wrap pad"><div class="check-card">
      <div class="cc-head"><span class="cc-brand"><img src="${fileUrl('design/logo/volve-symbol-paper.svg')}" alt="">Business Check</span><span class="cc-chip">${esc(c.chip || 'SAMPLE')}</span></div>
      <div class="cc-title">${esc(c.title)}</div>${rows}${foot}</div></div>`;
  }
  throw new Error(`Unknown card kind: ${c.kind}`);
}

function body(spec, format) {
  const brand = (surface) => `<div class="brand-slot pad"><img class="lockup" src="${LOCKUP[surface]}" alt="Volve Solutions"></div>`;
  switch (spec.layout) {
    case 'photo':
      return { cls: 's-dark', html: `${brand('dark')}<div class="pad">${headline(spec, 'headline')}</div>
        <div class="photo"><img src="${fileUrl(spec.image)}" alt=""></div>${callbar(spec, false)}` };
    case 'type': {
      const surface = spec.surface || 'dark';
      return { cls: `s-${surface}`, html: `${brand(surface)}<div class="pad">${headline(spec, spec.card ? 'medium' : 'display')}
        ${spec.body ? `<p class="body-copy">${markup(spec.body)}</p>` : ''}</div>${card(spec.card)}${callbar(spec, surface !== 'dark')}` };
    }
    case 'signal':
      return { cls: 's-signal', html: `${brand('signal')}<div class="pad">${headline(spec, 'display')}
        ${spec.body ? `<p class="body-copy">${markup(spec.body)}</p>` : ''}</div><div class="spacer"></div>${callbar(spec, true)}` };
    case 'site': {
      const phone = tokens.contact[`phone-${spec.phone || 'business-check'}`];
      const items = (spec.checklist || []).map((t) => `<li>${esc(t)}</li>`).join('');
      return { cls: 'l-site', html: `<div class="stripes"></div><div class="site-card">
        <div class="site-head">&#9888;&#xFE0E; ${esc(spec.header || 'Pre-start check')}</div>
        <div class="site-body">${headline(spec, 'display')}<p class="site-sub">${esc(spec.sub || '')}</p><ul class="checklist">${items}</ul></div>
        <div class="site-cta"><div class="eyebrow">${esc(spec.eyebrow || tokens.contact.offer.$value)}</div>
          <div class="phone fit-phone"><span class="lt">${esc(phone.display)}</span></div>
          <div class="meta"><img src="${LOCKUP.dark}" alt=""><span>&middot;</span><span>${esc(tokens.contact.web.$value)}</span></div></div>
        </div><div class="stripes"></div>` };
    }
    default:
      throw new Error(`Unknown layout: ${spec.layout}`);
  }
}

function page(spec, format) {
  const { cls, html } = body(spec, format);
  return `<!doctype html><html><head><meta charset="utf-8">
  <link rel="stylesheet" href="${fileUrl('design/tokens/volve.css')}">
  <link rel="stylesheet" href="${fileUrl('design/templates/social/social.css')}">
  </head><body><div class="post f-${format} l-${spec.layout} ${cls}">${html}</div></body></html>`;
}

// Shrinks any headline line or phone number that would break the safe margin.
async function fitAndCheck(p) {
  return p.evaluate(() => {
    const fit = (el) => {
      const max = el.clientWidth;
      let size = parseFloat(getComputedStyle(el).fontSize);
      const widest = () => Math.max(...[...el.querySelectorAll('.lt')].map((n) => n.getBoundingClientRect().width));
      while (widest() > max && size > 20) { size -= 2; el.style.fontSize = size + 'px'; }
      return size;
    };
    document.querySelectorAll('.fit, .fit-phone').forEach(fit);
    const post = document.querySelector('.post');
    const issues = [];
    if (post.scrollHeight > post.clientHeight + 1) issues.push(`content overflows by ${post.scrollHeight - post.clientHeight}px`);
    const photo = document.querySelector('.photo');
    if (photo && photo.clientHeight < 300) issues.push(`photo band only ${photo.clientHeight}px tall`);
    return issues;
  });
}

async function renderPosts(specFiles, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'volve-social-'));
  const browser = await chromium.launch();
  let problems = 0;
  for (const file of specFiles) {
    const spec = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const format of spec.formats || ['4x5']) {
      if (!FORMATS[format]) throw new Error(`${file}: unknown format ${format}`);
      if (spec.layout === 'site' && format !== '4x5') { console.log(`skip ${spec.id} ${format} (site style is 4x5 only)`); continue; }
      if (spec.card && format === '1x1') { console.log(`skip ${spec.id} 1x1 (card layouts are 4x5 and 9x16 only)`); continue; }
      const [width, height] = FORMATS[format];
      const p = await browser.newPage({ viewport: { width, height } });
      const htmlPath = path.join(tmp, `${spec.id}-${format}.html`);
      fs.writeFileSync(htmlPath, page(spec, format));
      await p.goto('file://' + htmlPath);
      await p.evaluate(() => document.fonts.ready);
      const issues = await fitAndCheck(p);
      const out = path.join(outDir, `${spec.id}-${format}.png`);
      await p.locator('.post').screenshot({ path: out });
      await p.close();
      problems += issues.length;
      console.log(`${issues.length ? 'WARN' : 'ok  '} ${path.relative(REPO, out)}${issues.length ? '  ' + issues.join('; ') : ''}`);
    }
  }
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  if (problems) process.exitCode = 1;
}

async function renderLogos() {
  const dir = path.join(DESIGN, 'logo');
  const outDir = path.join(dir, 'png');
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.svg'))) {
    const svg = fs.readFileSync(path.join(dir, f), 'utf8');
    const [, w, h] = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/).map(Number);
    const width = f.includes('lockup') ? 2400 : 1000;
    const height = Math.round((width * h) / w);
    const p = await browser.newPage({ viewport: { width, height } });
    await p.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${width}" height="${height}" `)}</body></html>`);
    await p.screenshot({ path: path.join(outDir, f.replace('.svg', '.png')), omitBackground: true });
    await p.close();
    console.log('ok  ', path.join('design/logo/png', f.replace('.svg', '.png')));
  }
  await browser.close();
}

(async () => {
  const args = process.argv.slice(2);
  if (args.includes('--logos')) return renderLogos();
  const outIdx = args.indexOf('--out');
  const outDir = outIdx >= 0 ? path.resolve(args[outIdx + 1]) : path.join(__dirname, 'out');
  const rest = args.filter((a, i) => a !== '--all' && (outIdx < 0 || (i !== outIdx && i !== outIdx + 1)));
  const postsDir = path.join(__dirname, 'posts');
  const files = args.includes('--all')
    ? fs.readdirSync(postsDir).filter((f) => f.endsWith('.json')).sort().map((f) => path.join(postsDir, f))
    : rest.map((f) => path.resolve(f));
  if (!files.length) { console.error('Usage: render.js <spec.json ...> | --all | --logos  [--out dir]'); process.exit(2); }
  await renderPosts(files, outDir);
})().catch((err) => { console.error(err); process.exit(1); });
