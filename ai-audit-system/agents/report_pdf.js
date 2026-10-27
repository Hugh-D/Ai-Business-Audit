const path = require('path');
const PDFDocument = require('pdfkit');
const industryRouter = require('./industry_router');
const reportEngine = require('./report_engine');

const FONTS = {
  regular: path.join(__dirname, '..', 'assets', 'fonts', 'Inter-Regular.ttf'),
  bold: path.join(__dirname, '..', 'assets', 'fonts', 'Inter-Bold.ttf'),
};

// Exact site palette. Everything else is a tint of these four.
const COLOR = {
  ochre: '#C47B2E',
  gold: '#E8A84A',
  ink: '#1C1410',
  paper: '#F9F6F1',
  muted: '#5E5148',
  soft: '#8A7D72',
  card: '#FFFFFF',
  border: '#E6DDD0',
  ochreTint: '#F6E9DA',
  goldTint: '#FBF0DC',
  inkTint: '#ECE7E1',
};

const BRAND = {
  name: 'Volve Solutions',
  phone: '(02) 5700 0037',
  website: 'volvesolutions.com.au',
  cta: 'Book your free review call',
};

// Volve symbol from public/assets/volve-symbol.svg (viewBox 749 x 604).
const LOGO_PATHS = [
  'M0 0H140L295 350L430 60C442 25 470 0 505 0H575L325 604C293 604 269 580 259 550L0 0Z',
  'M395 604H439C471 604 495 580 505 550L749 0H705C673 0 649 24 639 54L395 604Z',
];

const STATUS_LABEL = {
  red: { text: 'Fix first', fill: COLOR.ochre, ink: COLOR.paper, tint: COLOR.ochreTint },
  yellow: { text: 'Worth a look', fill: COLOR.gold, ink: COLOR.ink, tint: COLOR.goldTint },
  green: { text: 'Doing well', fill: COLOR.ink, ink: COLOR.paper, tint: COLOR.inkTint },
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const X = 42.52;
const TOP = 34;
const WIDTH = PAGE_W - (X * 2);
const FOOTER_Y = PAGE_H - 40;
const CONTENT_BOTTOM = FOOTER_Y - 14;

const STATUS_RANK = { red: 0, yellow: 1, green: 2 };
const URGENCY_RANK = { high: 0, medium: 1, low: 2 };
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

const DECK = 'A plain look at what came up on your call, and what to fix first.';
const DISCLAIMER = 'This check is based on what you told us on the call. It is a guide to help you decide what to tackle first, not a promise of results.';
const SCALES = [1.12, 1.08, 1.04, 1, 0.96, 0.92, 0.88];

function buildReportPdfBuffer(audit) {
  const model = buildTwoPageModel(audit);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 0,
      compress: false,
      autoFirstPage: true,
      info: {
        Title: `Your Business Check for ${model.preparedFor}`,
        Author: BRAND.name,
        Creator: BRAND.name,
        Subject: 'Business check from your free AI Business Audit call',
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
  const grounded = reportEngine.groundReport(audit.report || {}, audit.transcript || '');
  const report = toCustomerVoice(grounded, audit);
  const priority = report.priorityAnalysis || {};
  const actions = selectActions(report);
  const allFindings = rankFindings(report);
  const findings = selectFindings(report, allFindings, actions);
  const doingWell = selectStrengths(report, allFindings);
  const preparedFor = cleanText(audit.businessName)
    || cleanText(audit.contactName)
    || 'your business';

  return {
    preparedFor,
    contactName: firstName(audit.contactName),
    industryLabel: industryLabel(audit.industry),
    scoreLabel: formatScore(report.overallScore),
    findingCount: findings.length,
    firstAction: sentenceCase(cleanText(actions[0]?.timeframe)),
    headline: withoutMoneySentences(priority.highestImpactIssue)
      || findings[0]?.title
      || 'The biggest issue was not named on this call.',
    lede: firstSentences(executiveLede(report), 3) || firstSentences(withoutMoneySentences(priority.reasoning), 2),
    fastestWin: withoutMoneySentences(priority.fastestVisibleWin),
    reasoning: executiveLede(report) ? withoutMoneySentences(priority.reasoning) : '',
    actions,
    findings,
    doingWell,
    followUpPreferredTime: cleanText(audit.followUpPreferredTime),
    deck: DECK,
    disclaimer: DISCLAIMER,
    brand: { ...BRAND },
  };
}

function selectFindings(report, ranked, actions) {
  const problems = ranked.filter((item) => item.status !== 'green');
  const chosen = [];
  const used = new Set();

  for (const action of actions) {
    if (!action.problemArea || chosen.length >= 3) continue;
    const match = problems.find((item) => !used.has(item) && sameArea(item.title, action.problemArea));
    if (!match) continue;
    used.add(match);
    chosen.push(match);
  }
  for (const item of problems) {
    if (chosen.length >= 3) break;
    if (used.has(item)) continue;
    used.add(item);
    chosen.push(item);
  }
  chosen.sort((a, b) => statusRank(a.status) - statusRank(b.status));

  if (chosen.length || ranked.length) return chosen;

  return firstItems(report.criticalGaps, 3).map((gap) => ({
    title: withoutMoneySentences(gap) || cleanText(gap),
    status: '',
    currentState: '',
    fastestWin: '',
  })).filter((item) => item.title);
}

function selectStrengths(report, ranked) {
  const lines = [];
  const seen = new Set();
  const push = (title, text) => {
    const body = withoutMoneySentences(text);
    if (!body || reportEngine.isConditionalEffort(body)) return;
    const key = body.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (seen.has(key)) return;
    seen.add(key);
    lines.push({ title: cleanText(title), text: endSentence(body) });
  };
  for (const item of ranked.filter((finding) => finding.status === 'green')) {
    push(item.title, item.currentState);
  }
  const strengths = [].concat(report.keyStrengths || [], report.strengths || []);
  for (const item of strengths) {
    const text = cleanText(item);
    // Raw call quotes read badly as a strength line, so keep only summary statements.
    if (/\bsaid\s+['"]/.test(text)) continue;
    push('', text);
  }
  return lines.slice(0, 3);
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
    .map(({ item }) => {
      const status = normalStatus(item.status);
      return {
        title: plainTitle(item.problemArea) || 'Finding',
        status,
        currentState: currentStateFor(item, status),
        fastestWin: withoutMoneySentences(item.fastestWin),
      };
    });
}

// A weakness headline needs weakness evidence. "Calls back quickly, but 5 slip through"
// keeps only the part after "but"; pure praise falls back to the maturity summary.
function currentStateFor(item, status) {
  const evidence = withoutMoneySentences(item.evidence);
  const maturity = withoutMoneySentences(item.maturity);
  if (status === 'green') return maturity || evidence;
  if (!status) return evidence || maturity;
  const contrast = evidence.split(/,?\s+\b(?:but|however|although|yet)\b\s+(?:also\s+)?/i);
  if (contrast.length > 1) {
    const tail = contrast.slice(1).join(' ').trim();
    if (tail) {
      const subject = (evidence.match(/^([A-Z][a-z]+)\s/) || [])[1];
      const startsWithVerb = /^[a-z]+ed\b/.test(tail);
      return sentenceCase(endSentence(subject && startsWithVerb ? `${subject} also ${tail}` : tail));
    }
  }
  if (evidence && !reportEngine.isConditionalEffort(evidence) && looksPositive(evidence)) {
    return maturity || evidence;
  }
  return evidence || maturity;
}

function looksPositive(text) {
  return /\b(quickly|always|every|consistent(ly)?|straight away|on top of|no problem|zero|never miss)\b/i.test(text)
    && !/\b(slip|miss(ed)?|lost|never get|don'?t|no system|nothing|everything breaks|disappear)\b/i.test(text);
}

// Plain names for the engine's consultant-style area labels.
const PLAIN_TITLES = {
  'strategic priority': 'Your main goal for the next 30 days',
  'owner dependence': 'Everything runs through you',
  'admin overload': 'Too much admin',
  'lead visibility': 'Not knowing how many leads you lose',
  'lead response': 'Missed calls and enquiries',
  'lead ownership': 'Who chases new enquiries',
  'lead follow-up': 'Chasing up enquiries',
  'quote follow-up': 'Following up quotes',
  'reviews and reputation': 'Google reviews',
  'job profitability': 'Money left on the job',
};

function plainTitle(value) {
  const text = cleanText(value);
  return PLAIN_TITLES[text.toLowerCase()] || text;
}

function sameArea(left, right) {
  const a = cleanText(left).toLowerCase();
  const b = cleanText(right).toLowerCase();
  return a === b || plainTitle(a).toLowerCase() === plainTitle(b).toLowerCase();
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

// ---------- layout ----------
// Each block is { measure(s) -> height, draw(y, s) }. A page picks the largest scale
// that fits, then spreads any leftover room between blocks so there are no big gaps.

// If text still does not fit at the smallest size, these steps shorten whole items
// (never mid-sentence) until it does.
const COVER_TRIMS = [
  (m) => ({ ...m, lede: firstSentences(m.lede, 1) }),
  (m) => ({ ...m, fastestWin: firstClause(m.fastestWin) }),
  (m) => ({ ...m, actions: m.actions.map((a) => ({ ...a, action: firstClause(a.action) })) }),
  (m) => ({ ...m, lede: '' }),
  (m) => ({ ...m, actions: m.actions.slice(0, 2) }),
];
const FINDING_TRIMS = [
  (m) => ({ ...m, doingWell: m.doingWell.slice(0, 2) }),
  (m) => ({ ...m, findings: m.findings.map((f) => ({ ...f, fastestWin: firstClause(f.fastestWin) })) }),
  (m) => ({ ...m, findings: m.findings.map((f) => ({ ...f, currentState: firstSentences(f.currentState, 1) })) }),
  (m) => ({ ...m, doingWell: m.doingWell.slice(0, 1) }),
  (m) => ({ ...m, findings: m.findings.slice(0, 2), findingCount: m.findingCount }),
];

function drawReport(doc, model) {
  layoutPage(doc, model, coverBlocks, COVER_TRIMS, 1);
  doc.addPage({ size: 'A4', margin: 0 });
  layoutPage(doc, model, findingsBlocks, FINDING_TRIMS, 2);
}

function planPage(doc, model, buildBlocks, trims, avail) {
  const baseGap = 10;
  let current = model;
  for (let level = 0; level <= trims.length; level += 1) {
    const blocks = buildBlocks(doc, current);
    for (const s of SCALES) {
      const heights = blocks.map((block) => block.measure(s));
      const total = heights.reduce((a, b) => a + b, 0) + baseGap * (blocks.length - 1);
      if (total <= avail) return { blocks, scale: s, heights, model: current };
    }
    if (level < trims.length) current = trims[level](current);
  }
  const blocks = buildBlocks(doc, current);
  const scale = SCALES[SCALES.length - 1];
  return { blocks, scale, heights: blocks.map((block) => block.measure(scale)), model: current };
}

function layoutPage(doc, model, buildBlocks, trims, pageNumber) {
  fillPage(doc);
  const startY = drawHeader(doc, model, pageNumber);
  const avail = CONTENT_BOTTOM - startY;
  const { blocks, scale, heights } = planPage(doc, model, buildBlocks, trims, avail);
  const used = heights.reduce((a, b) => a + b, 0);
  const spare = Math.max(0, avail - used);
  const gap = blocks.length > 1 ? Math.min(34, Math.max(10, spare / (blocks.length - 1))) : 0;
  let y = startY;
  blocks.forEach((block, index) => {
    block.draw(y, scale);
    y += heights[index] + gap;
  });
  drawFooter(doc, model.preparedFor, pageNumber);
}

function coverBlocks(doc, model) {
  const blocks = [];
  blocks.push({
    measure: (s) => titleBlock(doc, model, 0, s, false),
    draw: (y, s) => titleBlock(doc, model, y, s, true),
  });
  blocks.push({
    measure: () => 64,
    draw: (y) => drawMetrics(doc, model, y),
  });
  blocks.push({
    measure: (s) => foundBlock(doc, model, 0, s, false),
    draw: (y, s) => foundBlock(doc, model, y, s, true),
  });
  if (model.fastestWin) {
    blocks.push({
      measure: (s) => callout(doc, 0, s, 'Quickest win', model.fastestWin, model.reasoning, false),
      draw: (y, s) => callout(doc, y, s, 'Quickest win', model.fastestWin, model.reasoning, true),
    });
  }
  if (model.actions.length) {
    blocks.push({
      measure: (s) => stepsBlock(doc, model, 0, s, false),
      draw: (y, s) => stepsBlock(doc, model, y, s, true),
    });
  }
  return blocks;
}

function findingsBlocks(doc, model) {
  const blocks = [];
  blocks.push({
    measure: (s) => findingsBlock(doc, model, 0, s, false),
    draw: (y, s) => findingsBlock(doc, model, y, s, true),
  });
  if (model.doingWell.length) {
    blocks.push({
      measure: (s) => strengthsBlock(doc, model, 0, s, false),
      draw: (y, s) => strengthsBlock(doc, model, y, s, true),
    });
  }
  blocks.push({
    measure: (s) => ctaBlock(doc, model, 0, s, false),
    draw: (y, s) => ctaBlock(doc, model, y, s, true),
  });
  return blocks;
}

function text(doc, draw, value, x, y, opts = {}) {
  const { font = 'Inter', size = 10, color = COLOR.ink, width = WIDTH, lineGap = 1.5, ...rest } = opts;
  doc.font(font).fontSize(size);
  const h = doc.heightOfString(value, { width, lineGap, ...rest });
  if (draw) {
    doc.fillColor(color).text(value, x, y, { width, lineGap, ...rest });
  }
  return h;
}

function drawHeader(doc, model, pageNumber) {
  const y = TOP;
  drawLogo(doc, X, y, 22);
  doc.font('Inter-Bold').fontSize(13).fillColor(COLOR.ink);
  doc.text(BRAND.name, X + 34, y + 3, { lineBreak: false });
  doc.font('Inter').fontSize(8.5).fillColor(COLOR.soft);
  const right = pageNumber === 1 ? BRAND.website : model.preparedFor;
  doc.text(right, X, y + 6, { width: WIDTH, align: 'right', lineBreak: false });
  const lineY = y + 32;
  doc.rect(X, lineY, WIDTH, 2).fill(COLOR.ochre);
  return lineY + 18;
}

function drawLogo(doc, x, y, h) {
  const scale = h / 604;
  doc.save();
  doc.translate(x, y).scale(scale);
  LOGO_PATHS.forEach((d, index) => {
    doc.path(d).fill(index === 0 ? COLOR.ochre : COLOR.gold);
  });
  doc.restore();
}

function kicker(doc, draw, label, y) {
  if (draw) {
    doc.font('Inter-Bold').fontSize(8.5).fillColor(COLOR.ochre);
    doc.text(String(label).toUpperCase(), X, y, { characterSpacing: 1.1, lineBreak: false });
  }
  return 15;
}

function titleBlock(doc, model, y, s, draw) {
  let h = 0;
  h += kicker(doc, draw, 'Free AI Business Audit', y);
  h += text(doc, draw, 'Your Business Check', X, y + h, { font: 'Inter-Bold', size: 30 * s, lineGap: 0 });
  h += 4;
  h += text(doc, draw, model.deck, X, y + h, { size: 11 * s, color: COLOR.muted });
  h += 12;
  h += text(doc, draw, 'PREPARED FOR', X, y + h, { font: 'Inter-Bold', size: 7.5, color: COLOR.soft, characterSpacing: 1.1 });
  h += 2;
  h += text(doc, draw, model.preparedFor, X, y + h, { font: 'Inter-Bold', size: 16 * s, lineGap: 0 });
  if (model.industryLabel) {
    h += 1;
    h += text(doc, draw, model.industryLabel, X, y + h, { size: 10 * s, color: COLOR.muted });
  }
  return h;
}

function drawMetrics(doc, model, y) {
  const items = [
    { value: model.scoreLabel, label: 'Your score', lead: true },
    { value: String(model.findingCount), label: 'Things to fix', lead: false },
  ];
  if (model.firstAction) items.push({ value: model.firstAction, label: 'Start with', lead: false });
  const gap = 8;
  const boxW = (WIDTH - (gap * (items.length - 1))) / items.length;
  const boxH = 64;
  items.forEach((item, index) => {
    const x = X + (index * (boxW + gap));
    doc.save();
    doc.roundedRect(x, y, boxW, boxH, 6).fill(item.lead ? COLOR.ink : COLOR.card);
    if (!item.lead) doc.lineWidth(0.7).strokeColor(COLOR.border).roundedRect(x, y, boxW, boxH, 6).stroke();
    doc.restore();
    let size = 22;
    doc.font('Inter-Bold');
    while (size > 11 && doc.fontSize(size).widthOfString(item.value) > boxW - 16) size -= 1;
    doc.fontSize(size).fillColor(item.lead ? COLOR.gold : COLOR.ink);
    doc.text(item.value, x + 8, y + 14 + ((22 - size) / 2), { width: boxW - 16, align: 'center', lineBreak: false });
    doc.font('Inter-Bold').fontSize(7.5).fillColor(item.lead ? COLOR.paper : COLOR.muted);
    doc.text(item.label.toUpperCase(), x + 6, y + 44, { width: boxW - 12, align: 'center', characterSpacing: 0.6, lineBreak: false });
  });
  return boxH;
}

function foundBlock(doc, model, y, s, draw) {
  let h = kicker(doc, draw, 'What we found', y);
  h += text(doc, draw, model.headline, X, y + h, { font: 'Inter-Bold', size: 15 * s, lineGap: 1 });
  if (model.lede) {
    h += 6;
    h += text(doc, draw, model.lede, X, y + h, { size: 10.5 * s, color: COLOR.ink });
  }
  return h;
}

function callout(doc, y, s, eyebrow, title, body, draw) {
  const pad = 14;
  const textX = X + pad + 4;
  const textW = WIDTH - pad * 2 - 4;
  let h = pad;
  const inner = (dy, d) => {
    let ih = 0;
    ih += text(doc, d, eyebrow.toUpperCase(), textX, dy + ih, { font: 'Inter-Bold', size: 8, color: COLOR.ochre, width: textW, characterSpacing: 0.9 });
    ih += 4;
    ih += text(doc, d, title, textX, dy + ih, { font: 'Inter-Bold', size: 11.5 * s, width: textW });
    if (body) {
      ih += 5;
      ih += text(doc, d, body, textX, dy + ih, { size: 10 * s, color: COLOR.muted, width: textW });
    }
    return ih;
  };
  h += inner(0, false) + pad;
  if (draw) {
    doc.roundedRect(X, y, WIDTH, h, 6).fill(COLOR.goldTint);
    doc.rect(X, y, 4, h).fill(COLOR.ochre);
    inner(y + pad, true);
  }
  return h;
}

function stepsBlock(doc, model, y, s, draw) {
  let h = kicker(doc, draw, 'Your first steps', y);
  model.actions.forEach((action, index) => {
    h += step(doc, y + h, s, index + 1, action, draw) + 6;
  });
  return h - 6;
}

function step(doc, y, s, number, action, draw) {
  const pad = 10;
  const textX = X + 40;
  const textW = WIDTH - 40 - pad - 8;
  const tag = sentenceCase(action.timeframe);
  const actionH = text(doc, false, action.action, textX, 0, { font: 'Inter-Bold', size: 10.5 * s, width: textW });
  const tagH = tag ? 16 : 0;
  const h = pad + tagH + actionH + pad;
  if (draw) {
    doc.roundedRect(X, y, WIDTH, h, 6).fill(COLOR.card);
    doc.lineWidth(0.7).strokeColor(COLOR.border).roundedRect(X, y, WIDTH, h, 6).stroke();
    doc.circle(X + 20, y + h / 2, 11).fill(COLOR.ochre);
    doc.font('Inter-Bold').fontSize(11).fillColor(COLOR.paper);
    doc.text(String(number), X + 9, y + h / 2 - 6.5, { width: 22, align: 'center', lineBreak: false });
    if (tag) pill(doc, textX, y + pad - 1, tag, COLOR.ochreTint, COLOR.ochre);
    text(doc, true, action.action, textX, y + pad + tagH, { font: 'Inter-Bold', size: 10.5 * s, width: textW });
  }
  return h;
}

function pill(doc, x, y, label, fill, color) {
  doc.font('Inter-Bold').fontSize(7.5);
  const w = doc.widthOfString(label.toUpperCase(), { characterSpacing: 0.6 }) + 14;
  doc.roundedRect(x, y, w, 13, 6.5).fill(fill);
  doc.fillColor(color).text(label.toUpperCase(), x + 7, y + 3, { characterSpacing: 0.6, lineBreak: false });
  return w;
}

function findingsBlock(doc, model, y, s, draw) {
  let h = kicker(doc, draw, 'What to fix first', y);
  h += text(doc, draw, 'Sort these out before adding anything new.', X, y + h, { font: 'Inter-Bold', size: 17 * s, lineGap: 0 });
  h += 10;
  if (!model.findings.length) {
    h += text(doc, draw, 'Nothing urgent came up on this call.', X, y + h, { size: 10.5 * s, color: COLOR.muted });
    return h;
  }
  model.findings.forEach((finding) => {
    h += findingCard(doc, y + h, s, finding, draw) + 8;
  });
  return h - 8;
}

function findingCard(doc, y, s, finding, draw) {
  const pad = 11;
  const textX = X + pad + 6;
  const textW = WIDTH - pad * 2 - 6;
  const labelW = 92;
  const bodyX = textX + labelW;
  const bodyW = textW - labelW;
  const look = STATUS_LABEL[finding.status];
  const row = (dy, d, label, value, color) => {
    const lh = text(doc, d, label, textX, dy + 1, { font: 'Inter-Bold', size: 8.5 * s, color: COLOR.ochre, width: labelW - 8 });
    const vh = text(doc, d, value, bodyX, dy, { size: 10 * s, color, width: bodyW });
    return Math.max(lh, vh);
  };
  const inner = (dy, d) => {
    let ih = 0;
    let pillW = 0;
    if (look && d) {
      doc.font('Inter-Bold').fontSize(7.5);
      pillW = doc.widthOfString(look.text.toUpperCase(), { characterSpacing: 0.6 }) + 14;
      pill(doc, X + WIDTH - pad - pillW, dy + 1, look.text, look.fill, look.ink);
    } else if (look) {
      doc.font('Inter-Bold').fontSize(7.5);
      pillW = doc.widthOfString(look.text.toUpperCase(), { characterSpacing: 0.6 }) + 14;
    }
    ih += text(doc, d, finding.title, textX, dy, { font: 'Inter-Bold', size: 12.5 * s, width: textW - pillW - 10 });
    if (finding.currentState) {
      ih += 6;
      ih += row(dy + ih, d, 'What you told us', finding.currentState, COLOR.ink);
    }
    if (finding.fastestWin) {
      ih += 5;
      ih += row(dy + ih, d, 'Quick fix', finding.fastestWin, COLOR.muted);
    }
    return ih;
  };
  const h = pad + inner(0, false) + pad;
  if (draw) {
    doc.roundedRect(X, y, WIDTH, h, 6).fill(COLOR.card);
    doc.lineWidth(0.7).strokeColor(COLOR.border).roundedRect(X, y, WIDTH, h, 6).stroke();
    doc.rect(X, y + 6, 4, h - 12).fill(look ? look.fill : COLOR.ochre);
    inner(y + pad, true);
  }
  return h;
}

function strengthsBlock(doc, model, y, s, draw) {
  const pad = 12;
  const textX = X + pad + 4;
  const textW = WIDTH - pad * 2 - 20;
  const inner = (dy, d) => {
    let ih = 0;
    if (d) pill(doc, textX, dy, STATUS_LABEL.green.text, STATUS_LABEL.green.fill, STATUS_LABEL.green.ink);
    ih += 19;
    model.doingWell.forEach((item) => {
      const line = item.title ? `${item.title}: ${item.text}` : item.text;
      if (d) doc.circle(textX + 3, dy + ih + 6, 2.2).fill(COLOR.ochre);
      ih += text(doc, d, line, textX + 14, dy + ih, { size: 10 * s, width: textW }) + 4;
    });
    return ih - 4;
  };
  const h = pad + inner(0, false) + pad;
  if (draw) {
    doc.roundedRect(X, y, WIDTH, h, 6).fill(COLOR.inkTint);
    inner(y + pad, true);
  }
  return h;
}

function ctaBlock(doc, model, y, s, draw) {
  const pad = 16;
  const textX = X + pad;
  const textW = WIDTH - pad * 2;
  const who = model.contactName ? `${model.contactName}, let's` : "Let's";
  const timing = model.followUpPreferredTime
    ? ` You said ${lowerFirst(stripEndPunctuation(model.followUpPreferredTime))} suits you.`
    : '';
  const body = `${who} talk through these on a quick call and agree what to fix first. It is free and there is no obligation.${timing}`;
  const inner = (dy, d) => {
    let ih = 0;
    ih += text(doc, d, 'YOUR NEXT STEP', textX, dy, { font: 'Inter-Bold', size: 8, color: COLOR.gold, width: textW, characterSpacing: 1 });
    ih += 4;
    ih += text(doc, d, body, textX, dy + ih, { size: 10.5 * s, color: COLOR.paper, width: textW });
    ih += 10;
    const btnLabel = `${BRAND.cta}: ${BRAND.phone}`;
    doc.font('Inter-Bold').fontSize(12.5);
    const btnW = Math.min(textW, doc.widthOfString(btnLabel) + 32);
    if (d) {
      doc.roundedRect(textX, dy + ih, btnW, 32, 16).fill(COLOR.ochre);
      doc.font('Inter-Bold').fontSize(12.5).fillColor(COLOR.paper);
      doc.text(btnLabel, textX, dy + ih + 9.5, { width: btnW, align: 'center', lineBreak: false });
    }
    ih += 32 + 8;
    ih += text(doc, d, `Or visit ${BRAND.website}`, textX, dy + ih, { font: 'Inter-Bold', size: 10, color: COLOR.gold, width: textW });
    return ih;
  };
  let h = pad + inner(0, false) + pad;
  if (draw) {
    doc.roundedRect(X, y, WIDTH, h, 8).fill(COLOR.ink);
    doc.link(X, y, WIDTH, h, 'tel:+61257000037');
    inner(y + pad, true);
  }
  h += 10;
  h += text(doc, draw, model.disclaimer, X, y + h, { size: 8.5, color: COLOR.soft });
  return h;
}

function drawFooter(doc, preparedFor, pageNumber) {
  doc.moveTo(X, FOOTER_Y).lineTo(X + WIDTH, FOOTER_Y).lineWidth(0.5).strokeColor(COLOR.border).stroke();
  doc.font('Inter').fontSize(8).fillColor(COLOR.soft);
  doc.text(`${BRAND.name}  |  ${BRAND.phone}  |  ${BRAND.website}`, X, FOOTER_Y + 6, { width: WIDTH - 70, lineBreak: false });
  doc.text(`Page ${pageNumber} of 2`, X, FOOTER_Y + 6, { width: WIDTH, align: 'right', lineBreak: false });
}

function fillPage(doc) {
  doc.save();
  doc.rect(0, 0, PAGE_W, PAGE_H).fill(COLOR.paper);
  doc.restore();
}

// ---------- customer voice ----------
// Older reports were written about the caller ("Logan said..."). The customer reads this,
// so customer-facing text is turned into second person and plain words before layout.

const PLAIN_SWAPS = [
  [/\bDeploy an automated missed-call text-back\b/g, 'Set up an auto text-back for missed calls'],
  [/\ban automated missed-call text-back\b/gi, 'an auto text-back for missed calls'],
  [/\bautomated missed-call text-back\b/gi, 'auto text-back for missed calls'],
  [/\bAutomated text-back\b/g, 'An auto text-back'],
  [/\bautomated post-job SMS\b/gi, 'automatic text after each job'],
  [/\b[Aa]n automated text-back\b/g, 'An auto text-back'],
  [/\bstraight away captures\b/gi, 'catches'],
  [/\bimmediately captures\b/gi, 'catches'],
  [/\bremoves the dependency on your availability for first contact\b/gi, 'means people hear back even when you are flat out'],
  [/\bhas no dependency on your time\b/gi, 'does not need your time'],
  [/\brequires minimal setup\b/gi, 'is quick to set up'],
  [/\brequires no hiring\b/gi, 'needs no extra staff'],
  [/\bwithin the first week of operation\b/gi, 'in the first week'],
  [/\bwould produce a visible result\b/gi, 'would show results'],
  [/\bThe operating picture is owner-dependent\b/g, 'Right now nearly everything runs through you'],
  [/\bowner-dependent\b/gi, 'reliant on you'],
  [/\bpreventing revenue leakage on\b/gi, 'so you are not losing money on'],
  [/\brevenue leakage\b/gi, 'losing money'],
  [/, which is a consistent and owner-managed process\b/gi, ', and that is working'],
  [/, indicating this is a rough guess rather than a measured figure\b/gi, ', which is a rough guess, not a count'],
  [/\bcommits? quoting time\b/gi, 'spend time quoting'],
  [/\binvest quoting time in\b/gi, 'spend time quoting for'],
  [/\bbudget readiness\b/gi, 'budget'],
  [/\bgenuinely ready to proceed\b/gi, 'ready to go ahead'],
  [/\bthe real volume of lost leads\b/gi, 'how many leads you really lose'],
  [/\bconfirm their enquiry details\b/gi, 'tell you what the job is'],
  [/\bconfirm their availability\b/gi, 'say when suits them'],
  [/\bany caller you cannot answer\b/gi, 'anyone you miss'],
  [/\bsends an SMS to\b/gi, 'texts'],
  [/\b(Deploy|Implement)\b/g, 'Set up'],
  [/\b(deploy|implement)\b/g, 'set up'],
  [/\bIntroduce\b/g, 'Start using'],
  [/\butili[sz]e\b/gi, 'use'],
  [/\bleverage\b/gi, 'use'],
  [/\bprospects\b/gi, 'customers'],
  [/\ba simple CRM or even a shared inbox log\b/gi, 'a simple list, even a notes app,'],
  [/\bA simple CRM or even a shared inbox log\b/g, 'A simple list, even a notes app,'],
  [/\beven a shared notes app or basic CRM\b/gi, 'even a notes app on your phone'],
  [/\bbasic CRM\b/gi, 'simple enquiry list'],
  [/\bqualifying intake\b/gi, 'set of screening questions'],
  [/\bqualifying questions\b/gi, 'a few screening questions'],
  [/\btyre-kickers\b/gi, 'people just shopping around'],
  [/\binbound enquiry\b/gi, 'enquiry'],
  [/\binbound enquiries\b/gi, 'enquiries'],
  [/\backnowledging\b/g, 'letting them know about'],
  [/\backnowledges\b/g, 'tells them about'],
  [/\bimmediately\b/gi, 'straight away'],
  [/\bapproximately\b/gi, 'about'],
  [/\bcommits quoting time\b/gi, 'spend time quoting'],
];

function toCustomerVoice(report, audit = {}) {
  if (!report || typeof report !== 'object') return report;
  const names = [firstName(audit.contactName), cleanText(audit.contactName)]
    .filter((name) => name && name.length > 1)
    .sort((a, b) => b.length - a.length);
  const business = cleanText(audit.businessName);
  const voice = (value) => (typeof value === 'string' ? speakToCustomer(value, names, business) : value);
  const next = JSON.parse(JSON.stringify(report));
  const mapList = (list) => (Array.isArray(list) ? list.map(voice) : list);
  next.strengths = mapList(next.strengths);
  next.keyStrengths = mapList(next.keyStrengths);
  next.criticalGaps = mapList(next.criticalGaps);
  if (next.sections && typeof next.sections === 'object') {
    for (const key of Object.keys(next.sections)) next.sections[key] = voice(next.sections[key]);
  }
  if (next.priorityAnalysis && typeof next.priorityAnalysis === 'object') {
    for (const key of Object.keys(next.priorityAnalysis)) next.priorityAnalysis[key] = voice(next.priorityAnalysis[key]);
  }
  if (Array.isArray(next.diagnosticFindings)) {
    next.diagnosticFindings = next.diagnosticFindings.map((item) => (item && typeof item === 'object' ? {
      ...item,
      evidence: voice(item.evidence),
      maturity: voice(item.maturity),
      likelyImpact: voice(item.likelyImpact),
      fastestWin: voice(item.fastestWin),
    } : item));
  }
  if (Array.isArray(next.actionPlan)) {
    next.actionPlan = next.actionPlan.map((item) => (item && typeof item === 'object' ? {
      ...item,
      action: voice(item.action),
      expectedImpact: voice(item.expectedImpact),
    } : voice(item)));
  }
  return next;
}

function escapeRe(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Rewrites prose outside quotes; quoted words are the caller's own and stay as said.
function speakToCustomer(value, names = [], business = '') {
  const parts = String(value).split(/('[^']{3,}?'(?=[\s,.;:!?)]|$)|"[^"]+")/);
  return parts.map((part, index) => (index % 2 ? part : rewriteProse(part, names, business))).join('');
}

function rewriteProse(input, names, business) {
  let text = input;
  if (business) text = text.replace(new RegExp(`\\b${escapeRe(business)}\\b`, 'g'), 'your business');
  const subjects = [...names.map(escapeRe), 'the business owner', 'the owner'];
  for (const subject of subjects) {
    const re = (body, flags = 'g') => new RegExp(body.replace(/SUBJ/g, subject), flags);
    text = text
      .replace(re("\\bSUBJ's\\b"), 'your')
      .replace(re('\\bSUBJ is\\b'), 'you are')
      .replace(re('\\bSUBJ has\\b'), 'you have')
      .replace(re('\\bSUBJ does\\b'), 'you do')
      .replace(re('\\bSUBJ (\\w+?)(ies)\\b'), (m, stem) => `you ${stem}y`)
      .replace(re('\\bSUBJ (personally |also |usually |only |still |already )?(\\w+?)(ches|shes|sses|xes)\\b'), (m, adv = '', stem, end) => `you ${adv}${stem}${end.slice(0, -2)}`)
      .replace(re('\\bSUBJ (personally |also |usually |only |still |already )?(\\w+[^s\\s])s\\b'), (m, adv = '', verb) => `you ${adv}${verb}`)
      .replace(re('\\bSUBJ\\b'), 'you');
  }
  text = text
    .replace(/\bhe is\b/gi, 'you are')
    .replace(/\bhe has\b/gi, 'you have')
    .replace(/\bhe does\b/gi, 'you do')
    .replace(/\bhe was\b/gi, 'you were')
    .replace(/\bhe (\w+[^s\s])s\b(?= (the|a|an|up|every|all|it|them|quotes?|jobs?|calls?)\b)/gi, 'you $1')
    .replace(/\bhe\b/gi, 'you')
    .replace(/\bhis\b/gi, 'your')
    .replace(/\bhimself\b/gi, 'yourself')
    .replace(/\bhim\b/gi, 'you')
    .replace(/\bthe business\b/g, 'your business')
    .replace(/\bThe business\b/g, 'Your business');
  for (const [pattern, swap] of PLAIN_SWAPS) text = text.replace(pattern, swap);
  text = text
    .replace(/\byou (am|is)\b/g, 'you are')
    .replace(/\byou was\b/g, 'you were')
    .replace(/\byou yourself\b/g, 'you')
    .replace(/\b(you (?:personally |also |usually |only |still |already |often |do )?)(\w+?)ies\b/gi, '$1$2y')
    .replace(/\b(you (?:personally |also |usually |only |still |already |often )?)(\w+?)(ches|shes|sses|xes)\b/gi, (m, lead, stem, end) => `${lead}${stem}${end.slice(0, -2)}`)
    .replace(/\b(you (?:personally |also |usually |only |still |already |often )?)(call|send|follow|chase|quote|invoice|handle|keep|leave|make|run|take|ask|get|want|need|use|work|try|do|say|record|track|check|answer|return|book|enter|write|miss|lose|know|feel|think)s\b/gi, '$1$2')
    .replace(/(^|[.!?]\s+)you\b/g, (m, lead) => `${lead}You`)
    .replace(/(^|[.!?]\s+)your\b/g, (m, lead) => `${lead}Your`)
    .replace(/(^|[.!?]\s+)([a-z])/g, (m, lead, ch) => `${lead}${ch.toUpperCase()}`);
  return text;
}

// ---------- text helpers ----------

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
  const shown = Number.isInteger(number) ? String(number) : String(Math.round(number * 10) / 10);
  return `${shown}/10`;
}

// Drops sentences with dollar figures. If the money sits after a dash, keeps the
// plain clause before it ("Missed enquiries slip through - at $5k a job..." -> first part).
function withoutMoneySentences(value) {
  const text = cleanText(value);
  if (!text) return '';
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => {
      if (!sentence.includes('$')) return sentence;
      const head = sentence.split(/\s-\s/)[0].trim();
      if (head && head !== sentence && !head.includes('$') && head.split(/\s+/).length >= 4) {
        return endSentence(head);
      }
      return '';
    })
    .filter(Boolean)
    .join(' ')
    .trim();
}

// Drops a " - aside - " in the middle of a sentence, or the tail after a single dash.
function firstClause(value) {
  const text = cleanText(value);
  if (!text) return '';
  const first = firstSentences(text, 1);
  const parts = first.split(/\s-\s/);
  if (parts.length >= 3) return endSentence(`${parts[0]} ${parts.slice(2).join(' ')}`.replace(/\s+,/g, ','));
  if (parts.length === 2 && parts[0].split(/\s+/).length >= 3) return endSentence(parts[0]);
  return first;
}

function firstSentences(value, count) {
  const text = cleanText(value);
  if (!text) return '';
  return text.split(/(?<=[.!?])\s+/).slice(0, count).join(' ');
}

function endSentence(value) {
  const text = cleanText(value).replace(/[,;:\s-]+$/, '');
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function stripEndPunctuation(value) {
  return cleanText(value).replace(/[.!?]+$/, '');
}

function sentenceCase(value) {
  const text = cleanText(value);
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

function lowerFirst(value) {
  const text = cleanText(value);
  if (!text) return '';
  if (/^[A-Z]{2}/.test(text)) return text;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function firstName(value) {
  return cleanText(value).split(' ')[0] || '';
}

function cleanText(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[—–]/g, ' - ')
    .replace(/…/g, '.')
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
  speakToCustomer,
  toCustomerVoice,
  BRAND,
  COLOR,
  buildReportFilename,
  buildReportPdfBuffer,
  buildTwoPageModel,
};
