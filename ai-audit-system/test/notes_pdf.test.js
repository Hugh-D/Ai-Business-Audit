'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { buildNotesPdfBuffer } = require('../agents/notes_pdf');

test('notes PDF contains the internal note text', async (t) => {
  const buf = await buildNotesPdfBuffer({ callId: 'call_x', businessName: 'Acme', reviewNotes: 'Check the quote follow-up', report: { keyStrengths: ['Fast replies'] } });
  assert.ok(buf.slice(0, 4).toString() === '%PDF');
  let text;
  try {
    const f = path.join(os.tmpdir(), `notes-${process.pid}.pdf`);
    fs.writeFileSync(f, buf);
    text = execFileSync('pdftotext', [f, '-'], { encoding: 'utf8' });
  } catch { t.skip('pdftotext not available'); return; }
  assert.match(text, /Check the quote follow-up/);
  assert.match(text, /Fast replies/);
});

test('internal print page is print-safe: system fonts, white backgrounds, no web font', () => {
  const src = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
  const doc = src.slice(src.indexOf('function buildExportDocument'), src.indexOf('function renderExportNotes'));
  assert.match(doc, /font-family: Arial, Helvetica, sans-serif/);
  assert.match(doc, /background: #fff !important/);
  assert.doesNotMatch(doc, /@font-face|woff2|background: var\(--espresso\)/);
  assert.match(doc, /Confidence/);
  assert.match(doc, /Volve fix/);
  assert.match(doc, /Evidence/);
});
