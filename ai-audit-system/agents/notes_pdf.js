'use strict';

// Internal notes as a real PDF: built-in Helvetica, solid black text, white page.
// Avoids web fonts and brand colours that some physical printers drop.
const PDFDocument = require('pdfkit');

function label(value) {
  return String(value || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function buildNotesPdfBuffer(call = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: 'Internal notes' } });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.fillColor('#000000');

    const heading = text => { doc.moveDown(0.6).font('Helvetica-Bold').fontSize(13).fillColor('#000').text(text); doc.moveDown(0.2); };
    const para = text => { doc.font('Helvetica').fontSize(10.5).fillColor('#000').text(String(text)); };
    const list = items => (Array.isArray(items) ? items : []).forEach(i => para(`- ${typeof i === 'string' ? i : JSON.stringify(i)}`));

    const r = call.report || {};
    doc.font('Helvetica-Bold').fontSize(18).text(`Internal notes: ${call.businessName || call.contactName || call.callId || 'Audit'}`);
    doc.moveDown(0.3).font('Helvetica').fontSize(10);
    [
      ['Call ID', call.callId], ['Contact', call.contactName], ['Phone', call.phoneNumber],
      ['Industry', call.industry && label(call.industry)], ['Review status', call.reviewStatus],
      ['Recipient', call.recipientEmail], ['Website', call.websiteUrl],
    ].filter(([, v]) => v).forEach(([k, v]) => para(`${k}: ${v}`));

    [['Internal Notes', call.reviewNotes], ['Delivery Notes', call.deliveryNotes], ['Follow-up Notes', call.followUpNotes]]
      .forEach(([k, v]) => { heading(k); para(v && String(v).trim() ? v : '(none)'); });

    if (r.overallScore != null) { heading('Overall score'); para(`${r.overallScore}/10`); }
    if (r.scores && Object.keys(r.scores).length) { heading('Score Breakdown'); Object.entries(r.scores).forEach(([k, v]) => para(`${label(k)}: ${v}/10`)); }
    if (r.keyStrengths?.length) { heading('Key Strengths'); list(r.keyStrengths); }
    if (r.criticalGaps?.length) { heading('Critical Gaps'); list(r.criticalGaps); }
    const pa = r.priorityAnalysis || {};
    if (Object.keys(pa).length) { heading('Priority Analysis'); Object.entries(pa).filter(([, v]) => v).forEach(([k, v]) => para(`${label(k)}: ${v}`)); }
    if (Array.isArray(r.actionPlan) && r.actionPlan.length) {
      heading('Action Plan');
      r.actionPlan.forEach(a => para(`- ${a.action || JSON.stringify(a)}${a.timeline ? ` (${a.timeline})` : ''}`));
    }
    if (call.transcript) { heading('Transcript'); para(call.transcript); }
    doc.end();
  });
}

module.exports = { buildNotesPdfBuffer };
