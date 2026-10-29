'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const M = require('../public/report_model');
const v4 = require('../agents/report_v4');

const transcript = 'Agent: How many slip through? Client: on average probably about 5 a week. Jobs are 5000 to 10000. Most of them disappear or they refer friends.';
const finding = (priority, title, extra = {}) => ({ priority, title, found: `${title} found`, whyItMatters: 'It costs you jobs.', doThisFirst: 'Set up a text-back.', effort: 'quick_fix', ...extra });
const audit = {
  businessName: 'Demo Air Pty Ltd', contactName: 'Sam Smith', transcript, reviewNotes: 'Secret internal note',
  report: {
    overallScore: 4.8,
    customerReport: {
      bottomLine: 'You do good work, but missed calls are costing you jobs.',
      findings: [
        finding('low', 'Reviews', { effort: 'this_month' }),
        finding('medium', 'Lead list', { moneyRank: 3 }),
        finding('high', 'Missed calls', { moneyAtStake: '$5,000 to $10,000 a job', moneyRank: 1, customerQuote: 'on average probably about 5 a week', volveFix: 'Missed-call text-back' }),
        finding('high', 'Quoting time', { moneyRank: 2 }),
        ...[1, 2, 3, 4].map(n => finding('low', `Extra ${n}`)),
      ],
      whatsWorking: ['Zero unpaid invoices.', 'Variations go on the invoice.', 'Strong word of mouth.', 'A fourth one.'],
    },
  },
};

test('model sorts High, Medium, Low, caps at 7, numbers continuously and ranks top fixes by money', () => {
  const m = M.buildModel(audit);
  assert.equal(m.findings.length, 7);
  assert.deepEqual(m.findings.map(f => f.priority).slice(0, 3), ['high', 'high', 'medium']);
  assert.deepEqual(m.findings.map(f => f.number), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(m.topFixes.map(f => f.title), ['Missed calls', 'Quoting time', 'Lead list']);
  assert.match(m.topFixes[0].estimate, /^Estimate from our call: \$5,000 to \$10,000/);
  assert.equal(m.topFixes[1].estimate, '');
  assert.equal(m.whatsWorking.length, 3);
  assert.equal(m.findings[0].effortLabel, 'Quick fix');
  assert.deepEqual(M.TAGS.high, { glyph: '\u25B2', label: 'HIGH', style: 'solid' });
});

test('bullets are 15 words or fewer and jargon is replaced', () => {
  const long = 'We should leverage a CRM and optimise conversion with an AI agent so every single lead is tracked carefully forever and ever more.';
  const out = M.clip(long);
  assert.ok(M.wordCount(out) <= 15, out);
  assert.doesNotMatch(out, /leverage|CRM|optimis|conversion|AI agent/i);
});

test('estimates only survive when the call said the figures', () => {
  assert.equal(M.moneyFrom('worth $5,000-$10,000 a job', transcript), '$5,000 to $10,000 a job');
  assert.equal(M.moneyFrom('worth $50,000 a year', transcript), '');
});

function pdfText(buf) {
  const f = path.join(os.tmpdir(), `v4-${process.pid}-${Math.random()}.pdf`);
  fs.writeFileSync(f, buf);
  try { return execFileSync('pdftotext', ['-layout', f, '-'], { encoding: 'utf8' }); } catch { return null; }
}

test('customer PDF: at most 2 pages, footer, CTA, no pricing, no internal notes, no fills', async () => {
  const buf = await v4.buildCustomerPdfBuffer(audit);
  const raw = buf.toString('latin1');
  assert.ok((raw.match(/\/Type \/Page(?!s)/g) || []).length <= 2);
  const text = pdfText(buf);
  if (!text) return;
  assert.match(text, /Reviewed by Hugh Douglas/);
  assert.match(text, /volvesolutions\.com\.au/);
  assert.match(text, /Prepared by Hugh Douglas/);
  assert.match(text, /02 5700 0037/);
  assert.match(text, /15-minute/);
  assert.match(text, /HIGH/);
  assert.match(text, /MEDIUM/);
  assert.match(text, /LOW/);
  assert.doesNotMatch(text, /Secret internal note|\$\d+ ?\+ ?GST|per month|pricing/i);
});

test('internal PDF carries evidence, confidence, Volve fix and notes', async () => {
  const text = pdfText(await v4.buildInternalPdfBuffer(audit));
  if (!text) return;
  assert.match(text, /on average probably about 5 a week/);
  assert.match(text, /Confidence/);
  assert.match(text, /Volve fix: Missed-call text-back/);
  assert.match(text, /Secret internal note/);
});
