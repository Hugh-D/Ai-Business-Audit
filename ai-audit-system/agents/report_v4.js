'use strict';

// v4 report PDFs: the customer Business Check (2 pages max, phone-first) and the
// internal Trades Readiness Audit. Print-safe: dark text on white only, no background
// fills or panels, embedded fonts, every block readable in greyscale.
const path = require('path');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const ReportModel = require('../public/report_model');

const FONTS = {
  regular: path.join(__dirname, '..', 'assets', 'fonts', 'Inter-Regular.ttf'),
  bold: path.join(__dirname, '..', 'assets', 'fonts', 'Inter-Bold.ttf'),
};

const C = {
  ochre: '#C47B2E', // headings and tags
  ink: '#1C1410', // all text
  gold: '#E8A84A', // highlights only (rules, logo), never text
  grey: '#6B6058', // low tag outline and secondary text, still >= 5:1 on white
  rule: '#B8AEA4',
};

const BRAND = {
  website: 'volvesolutions.com.au',
  phone: '02 5700 0037',
  tel: 'tel:+61257000037',
  preparedBy: 'Prepared by Hugh Douglas',
};

const LOGO_PATHS = [
  'M0 0H140L295 350L430 60C442 25 470 0 505 0H575L325 604C293 604 269 580 259 550L0 0Z',
  'M395 604H439C471 604 495 580 505 550L749 0H705C673 0 649 24 639 54L395 604Z',
];

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const X = 42;
const W = PAGE_W - X * 2;
const TOP = 36;
const FOOTER_Y = PAGE_H - 38;
const BOTTOM = FOOTER_Y - 12;
const QR_SIZE = 82; // 2.9 cm, above the 2.5 cm minimum

function newDoc(title) {
  const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true, bufferPages: true, info: { Title: title, Author: 'Hugh Douglas, Volve Solutions' } });
  doc.registerFont('R', FONTS.regular);
  doc.registerFont('B', FONTS.bold);
  return doc;
}

function finish(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

function logo(doc, x, y, h) {
  const s = h / 604;
  doc.save().translate(x, y).scale(s);
  doc.path(LOGO_PATHS[0]).fill(C.ochre);
  doc.path(LOGO_PATHS[1]).fill(C.gold);
  doc.restore();
}

function footers(doc) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.moveTo(X, FOOTER_Y).lineTo(X + W, FOOTER_Y).lineWidth(0.6).strokeColor(C.rule).stroke();
    doc.font('R').fontSize(8).fillColor(C.ink);
    doc.text(`${BRAND.website}   |   ${BRAND.phone}   |   ${BRAND.preparedBy}`, X, FOOTER_Y + 7, { width: W - 60, lineBreak: false });
    doc.text(`Page ${i + 1} of ${range.count}`, X, FOOTER_Y + 7, { width: W, align: 'right', lineBreak: false });
  }
}

// Tags: HIGH solid (thick border, filled marker), MEDIUM outlined, LOW grey outline. Always with the text label.
function tag(doc, x, y, priority) {
  const t = ReportModel.TAGS[priority] || ReportModel.TAGS.medium;
  const color = priority === 'low' ? C.grey : C.ochre;
  doc.font('B').fontSize(7.5);
  const w = doc.widthOfString(t.label) + 22;
  const h = 13;
  doc.roundedRect(x, y, w, h, 3).lineWidth(priority === 'high' ? 1.8 : 0.9).strokeColor(color).stroke();
  const cx = x + 8;
  const cy = y + h / 2;
  if (priority === 'high') doc.polygon([cx - 3.5, cy + 3], [cx + 3.5, cy + 3], [cx, cy - 3.5]).fill(color);
  else if (priority === 'medium') doc.circle(cx, cy, 3).fill(color);
  else doc.circle(cx, cy, 3).lineWidth(1).strokeColor(color).stroke();
  doc.fillColor(color).text(t.label, x + 15, y + 3, { lineBreak: false });
  return w;
}

// Flow helper: lays out blocks top to bottom, starting a new page when a block does not fit.
function flow(doc) {
  const st = { y: TOP };
  st.ensure = (h) => {
    if (st.y + h > BOTTOM) { doc.addPage(); st.y = TOP; return true; }
    return false;
  };
  return st;
}

function heading(doc, st, text, s) {
  st.ensure(40 * s);
  st.y += 8 * s;
  doc.font('B').fontSize(13 * s).fillColor(C.ochre).text(text.toUpperCase(), X, st.y, { width: W, characterSpacing: 0.4 });
  st.y = doc.y + 1;
  doc.moveTo(X, st.y).lineTo(X + 36, st.y).lineWidth(2).strokeColor(C.gold).stroke();
  st.y += 7 * s;
}

function bulletHeight(doc, label, text, width, size) {
  doc.font('R').fontSize(size);
  return doc.heightOfString(label ? `${label}: ${text}` : text, { width });
}

function bullet(doc, st, label, text, s, indent = 0) {
  const size = 9.6 * s;
  const bx = X + indent;
  const width = W - indent - 12;
  const h = bulletHeight(doc, label, text, width, size);
  st.ensure(h + 3);
  doc.circle(bx + 3, st.y + size * 0.55, 1.6).fill(C.ink);
  doc.fillColor(C.ink);
  if (label) {
    doc.font('B').fontSize(size).text(`${label}: `, bx + 12, st.y, { width, continued: true });
    doc.font('R').text(text);
  } else {
    doc.font('R').fontSize(size).text(text, bx + 12, st.y, { width });
  }
  st.y = doc.y + 2.5 * s;
}

function findingHeight(doc, f, s, opts) {
  let h = 22 * s;
  for (const b of f.bullets.slice(0, opts.maxBullets)) h += bulletHeight(doc, b.label, b.text, W - 22, 9.6 * s) + 2.5 * s;
  return h + 6 * s;
}

function finding(doc, st, f, s, opts, internal) {
  const minimum = 22 * s + (f.bullets[0] ? bulletHeight(doc, f.bullets[0].label, f.bullets[0].text, W - 22, 9.6 * s) : 0);
  st.ensure(internal ? minimum : Math.min(findingHeight(doc, f, s, opts), BOTTOM - TOP));
  const y = st.y;
  const tw = tag(doc, X, y + 1, f.priority);
  doc.font('B').fontSize(11 * s).fillColor(C.ink).text(`${f.number}. ${f.title}`, X + tw + 8, y, { width: W - tw - 110, lineBreak: false, ellipsis: true });
  doc.font('B').fontSize(8.5 * s).fillColor(C.ink).text(`Effort: ${f.effortLabel}`, X, y + 2, { width: W, align: 'right', lineBreak: false });
  st.y = y + 18 * s;
  for (const b of f.bullets.slice(0, opts.maxBullets)) bullet(doc, st, b.label, b.text, s, 10);
  if (internal) {
    if (f.customerQuote || f.evidence) bullet(doc, st, 'Evidence', f.customerQuote ? `"${f.customerQuote}"` : f.evidence, s, 10);
    bullet(doc, st, 'Confidence', f.confidence.charAt(0).toUpperCase() + f.confidence.slice(1), s, 10);
    if (f.volveFix) bullet(doc, st, 'Volve fix', f.volveFix, s, 10);
    if (f.moneyAtStake) bullet(doc, st, 'Estimate from call', f.moneyAtStake, s, 10);
  }
  st.y += 5 * s;
}

function cover(doc, st, m, s, title, kicker) {
  logo(doc, X, st.y, 16);
  doc.font('B').fontSize(10).fillColor(C.ink).text('VOLVE', X + 24, st.y + 3, { characterSpacing: 2, lineBreak: false });
  st.y += 30;
  doc.font('B').fontSize(9 * s).fillColor(C.ochre).text(kicker, X, st.y, { characterSpacing: 1 });
  st.y = doc.y + 2;
  doc.font('B').fontSize(24 * s).fillColor(C.ink).text(m.businessName, X, st.y, { width: W });
  st.y = doc.y + 2;
  doc.font('R').fontSize(10 * s).fillColor(C.ink).text(`${title}   |   ${m.date}   |   Reviewed by ${m.reviewedBy}`, X, st.y, { width: W });
  st.y = doc.y + 6;
}

function bottomLine(doc, st, m, s) {
  heading(doc, st, 'The bottom line', s);
  const box = 64 * s;
  const y = st.y;
  doc.roundedRect(X, y, box, box, 6).lineWidth(2).strokeColor(C.ochre).stroke();
  doc.font('B').fontSize(24 * s).fillColor(C.ink).text(m.score != null ? m.score.toFixed(1) : '-', X, y + box * 0.2, { width: box, align: 'center' });
  doc.font('R').fontSize(8 * s).fillColor(C.ink).text('out of 10', X, y + box * 0.64, { width: box, align: 'center' });
  doc.font('B').fontSize(11.5 * s).fillColor(C.ink).text(m.bottomLine, X + box + 14, y + 6, { width: W - box - 14 });
  st.y = Math.max(y + box, doc.y) + 6 * s;
}

function topFixes(doc, st, m, s) {
  if (!m.topFixes.length) return;
  heading(doc, st, 'Top 3 fixes', s);
  for (const f of m.topFixes) {
    const text = `${f.title}. ${f.action}`;
    doc.font('R').fontSize(10 * s);
    const h = doc.heightOfString(text, { width: W - 26 }) + (f.estimate ? 12 * s : 0);
    st.ensure(h + 4);
    doc.circle(X + 8, st.y + 7 * s, 8 * s).lineWidth(1.4).strokeColor(C.ochre).stroke();
    doc.font('B').fontSize(9.5 * s).fillColor(C.ink).text(String(f.rank), X, st.y + 2.5 * s, { width: 16 * s, align: 'center' });
    doc.font('B').fontSize(10 * s).fillColor(C.ink).text(`${f.title}. `, X + 26, st.y, { width: W - 26, continued: true });
    doc.font('R').text(`${f.action} (see finding ${f.number})`);
    if (f.estimate) doc.font('B').fontSize(8.8 * s).fillColor(C.ink).text(`${f.estimate} (estimate only)`, X + 26, doc.y + 1, { width: W - 26 });
    st.y = doc.y + 5 * s;
  }
}

function working(doc, st, m, s) {
  if (!m.whatsWorking.length) return;
  heading(doc, st, "What's working", s);
  for (const w of m.whatsWorking) bullet(doc, st, '', w, s);
}

function cta(doc, st, m, s, qr) {
  const h = QR_SIZE + 20;
  st.ensure(h + 30 * s);
  st.y += 8 * s;
  const y = st.y;
  doc.roundedRect(X, y, W, h, 6).lineWidth(1.8).strokeColor(C.ochre).stroke();
  doc.image(qr, X + W - QR_SIZE - 10, y + 10, { width: QR_SIZE, height: QR_SIZE });
  const tx = X + 16;
  const tw = W - QR_SIZE - 40;
  const first = m.contactName ? m.contactName.split(' ')[0] : '';
  doc.font('B').fontSize(10 * s).fillColor(C.ochre).text('YOUR NEXT STEP', tx, y + 14, { width: tw, characterSpacing: 0.8 });
  doc.font('B').fontSize(14 * s).fillColor(C.ink).text(`${first ? `${first}, let's` : "Let's"} have a free 15-minute chat.`, tx, doc.y + 3, { width: tw });
  doc.font('R').fontSize(10 * s).fillColor(C.ink).text("I'll walk you through these fixes and what I'd tackle first. No obligation.", tx, doc.y + 3, { width: tw });
  doc.font('B').fontSize(13 * s).fillColor(C.ink).text(`Call me on ${BRAND.phone}`, tx, doc.y + 5, { width: tw, link: BRAND.tel });
  doc.font('R').fontSize(8 * s).fillColor(C.ink).text('Or scan the code to call.', tx, doc.y + 2, { width: tw });
  st.y = y + h + 4;
}

function renderCustomer(doc, m, s, opts, qr) {
  const st = flow(doc);
  cover(doc, st, m, s, 'Business Check', 'YOUR FREE BUSINESS CHECK');
  bottomLine(doc, st, m, s);
  topFixes(doc, st, m, s);
  const list = m.findings.slice(0, opts.maxFindings).map(f => ({ ...f }));
  if (list.length) {
    heading(doc, st, 'What I found', s);
    for (const f of list) finding(doc, st, f, s, opts, false);
  }
  working(doc, st, m, s);
  cta(doc, st, m, s, qr);
  footers(doc);
}

const FIT_STEPS = [
  { s: 1, maxBullets: 5, maxFindings: 7 },
  { s: 0.95, maxBullets: 5, maxFindings: 7 },
  { s: 0.92, maxBullets: 4, maxFindings: 7 },
  { s: 0.9, maxBullets: 3, maxFindings: 7 },
  { s: 0.88, maxBullets: 3, maxFindings: 6 },
  { s: 0.86, maxBullets: 3, maxFindings: 5 },
  { s: 0.85, maxBullets: 3, maxFindings: 4 },
];

async function buildCustomerPdfBuffer(audit) {
  // The customer reads this: older third-person text ("Logan said") is turned to "you" first.
  const { toCustomerVoice } = require('./report_pdf');
  const m = ReportModel.buildModel({ ...audit, report: toCustomerVoice(audit.report || {}, audit) });
  const qr = await QRCode.toBuffer(BRAND.tel, { margin: 1, width: 400, color: { dark: '#000000', light: '#FFFFFF' } });
  const title = `Business Check for ${m.businessName}`;
  // Keep to 2 pages: try progressively tighter layouts and keep the first that fits.
  for (const step of FIT_STEPS) {
    const probe = newDoc(title);
    renderCustomer(probe, m, step.s, step, qr);
    const pages = probe.bufferedPageRange().count;
    if (pages <= 2 || step === FIT_STEPS[FIT_STEPS.length - 1]) {
      const doc = newDoc(title);
      renderCustomer(doc, m, step.s, step, qr);
      return finish(doc);
    }
  }
  return null;
}

async function buildInternalPdfBuffer(audit) {
  const m = ReportModel.buildModel(audit);
  const doc = newDoc(`Trades Readiness Audit: ${m.businessName}`);
  const s = 0.9;
  const st = flow(doc);
  cover(doc, st, m, s, 'Trades Readiness Audit (internal)', 'INTERNAL - NOT FOR THE CUSTOMER');
  const meta = [m.contactName && `Contact: ${m.contactName}`, audit.phoneNumber && `Phone: ${audit.phoneNumber}`, m.callId && `Call: ${m.callId}`, audit.reviewStatus && `Review: ${audit.reviewStatus}`].filter(Boolean).join('   |   ');
  if (meta) { doc.font('R').fontSize(8.5).fillColor(C.ink).text(meta, X, st.y, { width: W }); st.y = doc.y + 4; }
  bottomLine(doc, st, m, s);
  const sc = Object.entries(m.scores || {});
  if (sc.length) {
    doc.font('R').fontSize(9).fillColor(C.ink).text(sc.map(([k, v]) => `${k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())}: ${v}/10`).join('   |   '), X, st.y, { width: W });
    st.y = doc.y + 4;
  }
  topFixes(doc, st, m, s);
  if (m.findings.length) {
    heading(doc, st, 'Findings', s);
    for (const f of m.findings) finding(doc, st, f, s, { maxBullets: 5 }, true);
  }
  working(doc, st, m, s);
  const notes = [['Internal notes', m.notes.reviewNotes], ['Delivery notes', m.notes.deliveryNotes], ['Follow-up notes', m.notes.followUpNotes]];
  heading(doc, st, 'Notes', s);
  for (const [k, v] of notes) bullet(doc, st, k, v || '(none)', s);
  if (audit.transcript) {
    heading(doc, st, 'Transcript', s);
    doc.font('R').fontSize(8.5).fillColor(C.ink);
    for (const line of String(audit.transcript).split(/\n+/)) {
      const h = doc.heightOfString(line, { width: W });
      st.ensure(h + 2);
      doc.text(line, X, st.y, { width: W });
      st.y = doc.y + 2;
    }
  }
  footers(doc);
  return finish(doc);
}

module.exports = { buildCustomerPdfBuffer, buildInternalPdfBuffer, BRAND, C, QR_SIZE };
