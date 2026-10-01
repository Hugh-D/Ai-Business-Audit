const path = require('path');
const PDFDocument = require('pdfkit');
const industryRouter = require('./industry_router');

const FONTS = {
  regular: path.join(__dirname, '..', 'assets', 'fonts', 'Inter-Regular.ttf'),
  bold: path.join(__dirname, '..', 'assets', 'fonts', 'Inter-Bold.ttf'),
};

const COLOR = {
  ink: '#1C1410',
  canvas: '#F9F6F1',
  accent: '#C47B2E',
  slate: '#6B5E52',
  canvasSoft: '#F2EDE5',
  ochreBrown: '#7A4F1E',
  pale: '#FDF4E7',
  secondary: '#8A7D72',
  border: '#DDD5C8',
  danger: '#A43B35',
  dangerPale: '#F9E8E6',
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const X = 42.52;
const TOP = 36.85;
const WIDTH = PAGE_W - (X * 2);
const FOOTER_Y = PAGE_H - 42;

const STATUS_RANK = { red: 0, yellow: 1, green: 2 };
const URGENCY_RANK = { high: 0, medium: 1, low: 2 };
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

const DECK = 'A practical read of the gaps from your audit, and what to fix first.';

function buildReportPdfBuffer(audit) {
  const model = buildTwoPageModel(audit);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 0,
      compress: false,
      autoFirstPage: true,
      info: {
        Title: `Revenue and Operations Readiness Report for ${model.preparedFor}`,
        Author: 'AI Business Audit',
      },
    });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.registerFont('Inter', FONTS.regular);
    doc.registerFont('Inter-Bold', FONTS.bold);
    drawReport(doc, model);
    doc.end();
  });
}

function buildReportFilename(audit = {}) {
  return `${slugify(audit.industry || 'audit')}-${slugify(audit.auditId || audit.callId || 'report')}.pdf`;
}

function buildTwoPageModel(audit = {}) {
  const report = audit.report || {};
  const priority = report.priorityAnalysis || {};
  const findings = selectFindings(report);
  const actions = selectActions(report);
  const preparedFor = cleanText(audit.businessName)
    || cleanText(audit.contactName)
    || 'your business';

  return {
    preparedFor,
    industryLabel: industryLabel(audit.industry),
    scoreLabel: formatScore(report.overallScore),
    findingCount: findings.length,
    firstAction: cleanText(actions[0]?.timeframe),
    headline: withoutMoneySentences(priority.highestImpactIssue)
      || findings[0]?.title
      || 'The highest-impact issue was not named in this audit.',
    lede: executiveLede(report),
    fastestWin: withoutMoneySentences(priority.fastestVisibleWin),
    reasoning: withoutMoneySentences(priority.reasoning),
    actions,
    findings,
    followUpPreferredTime: cleanText(audit.followUpPreferredTime),
    deck: DECK,
  };
}

function selectFindings(report) {
  const ranked = rankFindings(report);
  const chosen = [];
  const used = new Set();

  for (const action of selectActions(report)) {
    if (!action.problemArea || chosen.length >= 3) continue;
    const match = ranked.find((item) => !used.has(item) && sameArea(item.title, action.problemArea));
    if (!match) continue;
    used.add(match);
    chosen.push(match);
  }

  for (const item of ranked) {
    if (chosen.length >= 3) break;
    if (used.has(item)) continue;
    used.add(item);
    chosen.push(item);
  }

  if (chosen.length) return chosen;

  return firstItems(report.criticalGaps, 3).map((gap) => ({
    title: cleanText(gap),
    status: '',
    currentState: '',
    fastestWin: '',
  })).filter((item) => item.title);
}

function rankFindings(report) {
  const source = Array.isArray(report.diagnosticFindings) ? report.diagnosticFindings : [];
  return source
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item && (
      cleanText(item.problemArea)
      || cleanText(item.evidence)
      || cleanText(item.maturity)
      || cleanText(item.fastestWin)
    ))
    .sort((a, b) => {
      const status = statusRank(a.item.status) - statusRank(b.item.status);
      if (status) return status;
      const urgency = urgencyRank(a.item.urgency) - urgencyRank(b.item.urgency);
      if (urgency) return urgency;
      return a.index - b.index;
    })
    .map(({ item }) => ({
      title: cleanText(item.problemArea) || 'Finding',
      status: normalStatus(item.status),
      currentState: withoutMoneySentences(item.evidence) || withoutMoneySentences(item.maturity),
      fastestWin: withoutMoneySentences(item.fastestWin),
    }));
}

function sameArea(left, right) {
  return cleanText(left).toLowerCase() === cleanText(right).toLowerCase();
}

function selectActions(report) {
  const source = Array.isArray(report.actionPlan) ? report.actionPlan : [];
  return source
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => cleanText(item?.action || (typeof item === 'string' ? item : '')))
    .sort((a, b) => {
      const rank = priorityRank(a.item?.priority) - priorityRank(b.item?.priority);
      return rank || a.index - b.index;
    })
    .slice(0, 3)
    .map(({ item }) => ({
      action: withoutMoneySentences(item.action || item),
      timeframe: cleanText(typeof item === 'object' ? item.timeframe : ''),
      problemArea: cleanText(typeof item === 'object' ? item.problemArea : ''),
    }))
    .filter((item) => item.action);
}

function drawReport(doc, model) {
  fillPage(doc);
  drawCover(doc, model);
  doc.addPage({ size: 'A4', margin: 0 });
  fillPage(doc);
  drawFindingsPage(doc, model);
}

function drawCover(doc, model) {
  let y = TOP;
  y = drawKicker(doc, 'AI Business Audit', X, y);
  doc.font('Inter-Bold').fontSize(28).fillColor(COLOR.ink);
  doc.text('Revenue & Operations', X, y, { width: WIDTH, lineGap: -4 });
  doc.text('Readiness Report', X, doc.y, { width: WIDTH, lineGap: -4 });
  y = doc.y + 10;

  doc.font('Inter').fontSize(11).fillColor(COLOR.slate);
  doc.text(model.deck, X, y, { width: 430, height: 34, ellipsis: true });
  y = doc.y + 12;

  doc.rect(X, y, 119, 2.4).fill(COLOR.ochreBrown);
  y += 14;

  doc.font('Inter-Bold').fontSize(8).fillColor(COLOR.secondary);
  doc.text('PREPARED FOR', X, y, { characterSpacing: 1.1, lineBreak: false });
  y += 16;
  doc.font('Inter-Bold').fontSize(16.5).fillColor(COLOR.ink);
  doc.text(model.preparedFor, X, y, { width: WIDTH, height: 22, ellipsis: true });
  y = doc.y + 2;
  if (model.industryLabel) {
    doc.font('Inter').fontSize(10.5).fillColor(COLOR.slate);
    doc.text(model.industryLabel, X, y, { width: WIDTH, height: 16, ellipsis: true });
    y = doc.y + 12;
  } else {
    y += 10;
  }

  y = drawMetrics(doc, model, y);
  y += 16;

  y = drawKicker(doc, '01  |  Executive diagnosis', X, y);
  doc.font('Inter-Bold').fontSize(15).fillColor(COLOR.ink);
  doc.text(model.headline, X, y, { width: WIDTH, height: 40, ellipsis: true });
  y = doc.y + 8;

  if (model.lede) {
    doc.font('Inter').fontSize(10.4).fillColor(COLOR.ink);
    doc.text(model.lede, X, y, { width: WIDTH, height: 42, ellipsis: true, lineGap: 1 });
    y = doc.y + 10;
  }

  if (model.fastestWin) {
    y = drawCallout(doc, y, 'Fastest visible win', model.fastestWin, model.reasoning);
  }

  if (model.actions.length) {
    doc.font('Inter-Bold').fontSize(12).fillColor(COLOR.ochreBrown);
    doc.text('What matters most now', X, y, { lineBreak: false });
    y += 18;
    model.actions.forEach((action, index) => {
      y = drawStep(doc, y, index + 1, action.action, action.timeframe);
    });
  }

  drawFooter(doc, model.preparedFor, 1);
}

function drawFindingsPage(doc, model) {
  let y = TOP;
  doc.font('Inter-Bold').fontSize(8.5).fillColor(COLOR.ochreBrown);
  doc.text('AI BUSINESS AUDIT', X, y, { characterSpacing: 1.1, lineBreak: false });
  doc.font('Inter').fontSize(8.5).fillColor(COLOR.secondary);
  doc.text(model.preparedFor, X, y, { width: WIDTH, align: 'right', height: 12, ellipsis: true });
  y += 16;
  doc.moveTo(X, y).lineTo(X + WIDTH, y).lineWidth(0.7).strokeColor(COLOR.border).stroke();
  y += 14;

  y = drawKicker(doc, '02  |  The findings that matter', X, y);
  doc.font('Inter-Bold').fontSize(16).fillColor(COLOR.ink);
  doc.text('Fix these before adding anything new.', X, y, { width: WIDTH, height: 24, ellipsis: true });
  y = doc.y + 12;

  if (!model.findings.length) {
    doc.font('Inter').fontSize(10.5).fillColor(COLOR.slate);
    doc.text('This audit did not return findings to list here.', X, y, { width: WIDTH });
    y = doc.y + 14;
  } else {
    for (const finding of model.findings) {
      y = drawFinding(doc, y, finding);
    }
  }

  y = drawNextStep(doc, y, model);
  y += 16;
  doc.font('Inter').fontSize(9.5).fillColor(COLOR.slate);
  doc.text('The score is a decision aid, not a financial forecast.', X, y, { width: WIDTH });
  y = doc.y + 8;
  doc.font('Inter-Bold').fontSize(10.5).fillColor(COLOR.ink);
  doc.text('AI Business Audit', X, y, { lineBreak: false });
  y += 14;
  doc.font('Inter').fontSize(9.5).fillColor(COLOR.slate);
  doc.text('Prepared for discussion with Hugh.', X, y, { lineBreak: false });

  drawFooter(doc, model.preparedFor, 2);
}

function drawMetrics(doc, model, y) {
  const items = [
    { value: model.scoreLabel, label: 'Readiness score', lead: true },
    { value: String(model.findingCount), label: 'Priority findings', lead: false },
  ];
  if (model.firstAction) {
    items.push({ value: model.firstAction, label: 'First action', lead: false });
  }
  const gap = 7;
  const boxW = (WIDTH - (gap * (items.length - 1))) / items.length;
  const boxH = 58;
  items.forEach((item, index) => {
    const x = X + (index * (boxW + gap));
    doc.save();
    doc.rect(x, y, boxW, boxH).fill(item.lead ? COLOR.ink : COLOR.canvasSoft);
    if (!item.lead) {
      doc.lineWidth(0.6).strokeColor(COLOR.border).rect(x, y, boxW, boxH).stroke();
    }
    doc.restore();
    const valueSize = item.value.length > 14 ? 10 : 18;
    doc.font('Inter-Bold').fontSize(valueSize).fillColor(item.lead ? COLOR.canvas : COLOR.ink);
    doc.text(item.value, x + 8, y + (valueSize === 18 ? 10 : 14), {
      width: boxW - 16,
      align: 'center',
      height: 22,
      ellipsis: true,
    });
    doc.font('Inter-Bold').fontSize(7.2).fillColor(item.lead ? COLOR.canvas : COLOR.slate);
    doc.text(item.label.toUpperCase(), x + 6, y + 36, {
      width: boxW - 12,
      align: 'center',
      characterSpacing: 0.5,
      height: 16,
      ellipsis: true,
    });
  });
  return y + boxH;
}

function drawCallout(doc, y, eyebrow, title, body) {
  const textX = X + 12;
  const textW = WIDTH - 24;
  doc.font('Inter-Bold').fontSize(11.5);
  const titleHeight = Math.min(32, doc.heightOfString(title, { width: textW }));
  doc.font('Inter').fontSize(10);
  const bodyHeight = body ? Math.min(28, doc.heightOfString(body, { width: textW })) : 0;
  const h = 12 + 12 + titleHeight + (body ? 6 + bodyHeight : 0) + 10;
  doc.rect(X, y, WIDTH, h).fill(COLOR.pale);
  doc.rect(X, y, 3, h).fill(COLOR.ochreBrown);
  doc.font('Inter-Bold').fontSize(8).fillColor(COLOR.ochreBrown);
  doc.text(eyebrow.toUpperCase(), textX, y + 8, { characterSpacing: 0.8, lineBreak: false });
  doc.font('Inter-Bold').fontSize(11.5).fillColor(COLOR.ink);
  doc.text(title, textX, y + 22, { width: textW, height: titleHeight + 2, ellipsis: true });
  if (body) {
    doc.font('Inter').fontSize(10).fillColor(COLOR.slate);
    doc.text(body, textX, y + 24 + titleHeight, { width: textW, height: bodyHeight + 2, ellipsis: true });
  }
  return y + h + 12;
}

function drawStep(doc, y, number, action, timeframe) {
  const textX = X + 36;
  const textW = WIDTH - 48;
  doc.font('Inter-Bold').fontSize(10.4);
  const actionHeight = Math.min(28, doc.heightOfString(action, { width: textW }));
  const rowH = Math.max(36, 8 + actionHeight + (timeframe ? 14 : 0) + 6);
  doc.rect(X, y, WIDTH, rowH).fill(COLOR.canvasSoft);
  doc.rect(X, y, 26, rowH).fill(COLOR.ochreBrown);
  doc.font('Inter-Bold').fontSize(12).fillColor(COLOR.canvas);
  doc.text(String(number), X, y + (rowH / 2) - 7, { width: 26, align: 'center', lineBreak: false });
  doc.font('Inter-Bold').fontSize(10.4).fillColor(COLOR.ink);
  doc.text(action, textX, y + 6, { width: textW, height: actionHeight + 1, ellipsis: true });
  if (timeframe) {
    doc.font('Inter').fontSize(9).fillColor(COLOR.slate);
    doc.text(timeframe, textX, y + rowH - 16, { width: textW, height: 12, ellipsis: true });
  }
  return y + rowH + 4;
}

function drawFinding(doc, y, finding) {
  const h = 118;
  const statusW = finding.status ? 70 : 0;
  const bodyX = X + statusW;
  const bodyW = WIDTH - statusW;
  const textX = bodyX + 12;
  const textW = bodyW - 24;
  const statusFill = finding.status === 'red'
    ? COLOR.danger
    : finding.status === 'yellow'
      ? COLOR.accent
      : COLOR.ink;
  const bodyFill = finding.status === 'red'
    ? COLOR.dangerPale
    : finding.status === 'yellow'
      ? COLOR.pale
      : COLOR.canvasSoft;

  if (statusW) {
    doc.rect(X, y, statusW, h).fill(statusFill);
    doc.font('Inter-Bold').fontSize(8).fillColor(COLOR.canvas);
    doc.text(finding.status.toUpperCase(), X + 4, y + (h / 2) - 5, {
      width: statusW - 8,
      align: 'center',
      characterSpacing: 0.8,
      lineBreak: false,
    });
  }
  doc.rect(bodyX, y, bodyW, h).fill(bodyFill);

  doc.font('Inter-Bold').fontSize(12).fillColor(COLOR.ink);
  doc.text(finding.title, textX, y + 8, { width: textW, height: 16, ellipsis: true });

  if (finding.currentState) {
    doc.font('Inter-Bold').fontSize(9).fillColor(COLOR.ink);
    doc.text('Current state', textX, y + 28, { lineBreak: false });
    doc.font('Inter').fontSize(9.5).fillColor(COLOR.slate);
    doc.text(finding.currentState, textX, y + 40, { width: textW, height: 24, ellipsis: true });
  }
  if (finding.fastestWin) {
    doc.font('Inter-Bold').fontSize(9).fillColor(COLOR.ink);
    doc.text('Fastest win', textX, y + 68, { lineBreak: false });
    doc.font('Inter').fontSize(9.5).fillColor(COLOR.slate);
    doc.text(finding.fastestWin, textX, y + 80, { width: textW, height: 28, ellipsis: true });
  }
  return y + h + 8;
}

function drawNextStep(doc, y, model) {
  const focus = model.findings.length
    ? 'Use it to agree which of these findings to fix first.'
    : 'Use it to agree what to fix first.';
  const timing = model.followUpPreferredTime
    ? `Preferred timing noted from the call: ${model.followUpPreferredTime}.`
    : '';
  const body = [focus, timing].filter(Boolean).join(' ');
  const textX = X + 12;
  const textW = WIDTH - 24;
  doc.font('Inter').fontSize(10);
  const bodyHeight = Math.min(36, doc.heightOfString(body, { width: textW }));
  const h = 12 + 12 + 18 + 6 + bodyHeight + 10;
  doc.rect(X, y, WIDTH, h).fill(COLOR.pale);
  doc.rect(X, y, 3, h).fill(COLOR.accent);
  doc.font('Inter-Bold').fontSize(8).fillColor(COLOR.ochreBrown);
  doc.text('RECOMMENDED NEXT STEP', textX, y + 8, { characterSpacing: 0.8, lineBreak: false });
  doc.font('Inter-Bold').fontSize(13).fillColor(COLOR.ink);
  doc.text('A short discussion with Hugh', textX, y + 22, { width: textW, height: 18, ellipsis: true });
  doc.font('Inter').fontSize(10).fillColor(COLOR.slate);
  doc.text(body, textX, y + 44, { width: textW, height: bodyHeight + 2, ellipsis: true });
  return y + h;
}

function drawKicker(doc, text, x, y) {
  doc.font('Inter-Bold').fontSize(8.5).fillColor(COLOR.ochreBrown);
  doc.text(String(text).toUpperCase(), x, y, {
    width: WIDTH,
    characterSpacing: 1.05,
    lineBreak: false,
  });
  return y + 16;
}

function drawFooter(doc, preparedFor, pageNumber) {
  doc.moveTo(X, FOOTER_Y).lineTo(X + WIDTH, FOOTER_Y).lineWidth(0.5).strokeColor(COLOR.border).stroke();
  doc.font('Inter').fontSize(8).fillColor(COLOR.secondary);
  doc.text(`Confidential. Prepared for ${preparedFor}.`, X, FOOTER_Y + 6, {
    width: WIDTH - 70,
    height: 12,
    ellipsis: true,
    lineBreak: false,
  });
  doc.text(`Page ${pageNumber} of 2`, X, FOOTER_Y + 6, {
    width: WIDTH,
    align: 'right',
    lineBreak: false,
  });
}

function fillPage(doc) {
  doc.save();
  doc.rect(0, 0, PAGE_W, PAGE_H).fill(COLOR.canvas);
  doc.restore();
}

function executiveLede(report) {
  const sections = report.sections && typeof report.sections === 'object' ? report.sections : {};
  const keyed = typeof sections.executiveSummary === 'string'
    ? sections.executiveSummary
    : Object.entries(sections).find(([key, value]) => /executive/i.test(key) && typeof value === 'string')?.[1];
  if (!keyed) return '';
  const paragraph = String(keyed).replace(/\r\n/g, '\n').trim().split(/\n\s*\n/)[0] || '';
  return withoutMoneySentences(paragraph.replace(/\n/g, ' '));
}

function industryLabel(industry) {
  const value = cleanText(industry);
  if (!value) return '';
  try {
    return cleanText(industryRouter.resolve(value).label) || formatLabel(value);
  } catch {
    return formatLabel(value);
  }
}

function formatScore(value) {
  if (value === null || value === undefined || value === '') return '-';
  const number = Number(value);
  if (!Number.isFinite(number)) return cleanText(value) || '-';
  return Number.isInteger(number) ? String(number) : String(Math.round(number * 10) / 10);
}

function withoutMoneySentences(value) {
  const text = cleanText(value);
  if (!text) return '';
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !sentence.includes('$'))
    .join(' ')
    .trim();
}

function cleanText(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[—–]/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalStatus(value) {
  const status = cleanText(value).toLowerCase();
  if (status === 'red' || status === 'yellow' || status === 'green') return status;
  return '';
}

function statusRank(value) {
  return STATUS_RANK[cleanText(value).toLowerCase()] ?? 9;
}

function urgencyRank(value) {
  return URGENCY_RANK[cleanText(value).toLowerCase()] ?? 9;
}

function priorityRank(value) {
  return PRIORITY_RANK[cleanText(value).toLowerCase()] ?? 9;
}

function firstItems(value, count) {
  return Array.isArray(value) ? value.filter(Boolean).slice(0, count) : [];
}

function formatLabel(value) {
  return String(value)
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'report';
}

module.exports = {
  buildReportFilename,
  buildReportPdfBuffer,
  buildTwoPageModel,
};
