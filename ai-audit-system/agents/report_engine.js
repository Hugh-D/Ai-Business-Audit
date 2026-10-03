const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BASE_PROMPT = fs.readFileSync(
  path.join(__dirname, '../prompts/base_report.txt'),
  'utf8'
);

// Generates a structured audit report from a cleaned transcript and industry config.
async function generate({ config, transcript }) {
  const systemPrompt = buildSystemPrompt(config);
  const userMessage = buildUserMessage(config, transcript);

  const response = await client.messages.create({
    model: process.env.AUDIT_MODEL || 'claude-sonnet-4-6',
    max_tokens: parseInt(process.env.AUDIT_MAX_TOKENS || '5000', 10),
    system: systemPrompt,
    messages: [
      { role: 'user', content: userMessage },
    ],
  });

  const raw = response.content.find(b => b.type === 'text')?.text;
  if (!raw) throw new Error('No text content in Anthropic response');
  if (response.stop_reason === 'max_tokens') {
    throw new Error('Anthropic report response was truncated; increase AUDIT_MAX_TOKENS');
  }
  return groundReport(parseJsonReport(raw), transcript);
}

function parseJsonReport(raw) {
  try {
    return JSON.parse(raw);
  } catch (_err) {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) return JSON.parse(fenced[1]);

    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(raw.slice(firstBrace, lastBrace + 1));
    }

    throw new Error('Report engine returned text that was not valid JSON');
  }
}

function buildSystemPrompt(config) {
  return BASE_PROMPT
    .replace('{{INDUSTRY_LABEL}}', config.label)
    .replace('{{REPORT_SECTIONS}}', config.reportSections.join('\n- '))
    .replace('{{AUDIT_FOCUS}}', config.auditFocus.join('\n- '))
    .replace('{{SCORING_WEIGHTS}}', JSON.stringify(config.scoringWeights, null, 2));
}

function buildUserMessage(config, transcript) {
  return [
    `Industry: ${config.label}`,
    `Benchmarks: ${JSON.stringify(config.benchmarks)}`,
    '',
    '--- TRANSCRIPT ---',
    transcript,
    '--- END TRANSCRIPT ---',
    '',
    'Generate the audit report as a JSON object following the system prompt structure.',
  ].join('\n');
}


const TRANSCRIPT_FOLLOW_UP_STATUSES = new Set(['not_offered', 'declined', 'requested', 'booked']);

function textOrEmpty(value) {
  if (value == null) return '';
  return String(value).trim();
}

// Drops a model-invented calendar timestamp. A spoken "Thursday at 1" or "Monday" is kept.
function spokenFollowUpTime(value) {
  const text = textOrEmpty(value);
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(text)) {
    return '';
  }
  return text;
}

// Structured header fields from the same report JSON. Blank strings mean "not stated".
function callerFieldsFromReport(report = {}) {
  const status = textOrEmpty(report.followUpStatus).toLowerCase().replace(/\s+/g, '_');
  const followUpStatus = TRANSCRIPT_FOLLOW_UP_STATUSES.has(status) ? status : '';
  return {
    contactName: textOrEmpty(report.contactName),
    businessName: textOrEmpty(report.businessName),
    recipientEmail: textOrEmpty(report.recipientEmail || report.email || report.contactEmail),
    phoneNumber: spokenMobile(report.phoneNumber || report.mobile || report.contactPhone || report.mobileNumber),
    followUpStatus,
    followUpPreferredTime: followUpStatus === 'booked' ? spokenFollowUpTime(report.followUpPreferredTime) : '',
  };
}

// Australian mobile as the caller would hear it read back: 0474 779 497.
function spokenMobile(value) {
  const text = textOrEmpty(value);
  if (!text) return '';
  const match = text.match(/(?:\+?\s*61|0)\s*4(?:[\s().-]?\d){8}/);
  if (!match) return '';
  let digits = match[0].replace(/\D/g, '');
  if (digits.startsWith('61')) digits = `0${digits.slice(2)}`;
  if (!/^04\d{8}$/.test(digits)) return '';
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
}

function mobileAppearsIn(formatted, transcript) {
  const local = String(formatted || '').replace(/\D/g, '').replace(/^0/, '');
  if (local.length < 9) return false;
  return String(transcript || '').replace(/\D/g, '').includes(local);
}

// Last mobile the caller confirmed, either by agreeing to a read-back or by stating it as their number.
function confirmedMobileFromTranscript(transcript) {
  const text = String(transcript || '');
  const re = /(?:\+?\s*61[\s().-]*|\b0)\s*4(?:[\s().-]?\d){8}\b/g;
  let match;
  let last = '';
  while ((match = re.exec(text))) {
    const before = text.slice(Math.max(0, match.index - 80), match.index);
    const after = text.slice(match.index + match[0].length, match.index + match[0].length + 400);
    const readback = /\b(is that right|is that correct|did i get that right)\b/i.test(after.slice(0, 180));
    const affirmed = /\b(yes|yeah|yep|yah|correct)\b|that(?:'s| is) (?:right|correct)\b/i.test(after);
    const aboutMobile = /\b(mobile|cell|number)\b/i.test(`${before}${after.slice(0, 80)}`);
    if (!affirmed || (!readback && !aboutMobile)) continue;
    const formatted = spokenMobile(match[0]);
    if (formatted) last = formatted;
  }
  return last;
}

// Confirmed spoken mobile wins. A blank result means "keep the saved caller ID".
function confirmedPhoneNumber({ report = {}, transcript = '' } = {}) {
  const fromTranscript = confirmedMobileFromTranscript(transcript);
  if (fromTranscript) return fromTranscript;
  const fromReport = spokenMobile(report.phoneNumber || report.mobile || report.contactPhone || report.mobileNumber);
  const transcriptText = textOrEmpty(transcript);
  if (fromReport && (!transcriptText || mobileAppearsIn(fromReport, transcriptText))) return fromReport;
  return '';
}

const NUMBER_WORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

function wordToNumber(phrase) {
  const parts = String(phrase || '').toLowerCase().replace(/-/g, ' ').split(/\s+/).filter(Boolean);
  if (!parts.length) return NaN;
  let total = 0;
  for (const part of parts) {
    if (!Number.isFinite(NUMBER_WORDS[part])) return NaN;
    total += NUMBER_WORDS[part];
  }
  return total;
}

function numberToken(token) {
  if (/^\d/.test(token)) return Number(String(token).replace(/,/g, ''));
  return wordToNumber(token);
}

const NUMBER_TOKEN = '(?:\\d+(?:\\.\\d+)?|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[\\s-](?:one|two|three|four|five|six|seven|eight|nine))';

function percentFigures(text) {
  const found = new Set();
  const re = new RegExp(`\\b(${NUMBER_TOKEN})(?:\\s*(?:-|–|—|to|or)\\s*(${NUMBER_TOKEN}))?\\s*(?:%|percent\\b|per\\s+cent\\b)`, 'gi');
  let match;
  while ((match = re.exec(String(text || '')))) {
    const first = numberToken(match[1]);
    if (Number.isFinite(first)) found.add(String(first));
    if (match[2]) {
      const second = numberToken(match[2]);
      if (Number.isFinite(second)) found.add(String(second));
    }
  }
  return found;
}

function moneyFigures(text) {
  const found = new Set();
  const source = String(text || '');
  const numeric = /\$?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\s*(k|m|thousand|grand)?\b/gi;
  let match;
  while ((match = numeric.exec(source))) {
    const raw = match[0];
    if (!raw.includes('$') && !match[2] && !/\b(dollars?|bucks)\b/i.test(source.slice(match.index, match.index + match[0].length + 12))) {
      continue;
    }
    let amount = Number(match[1].replace(/,/g, ''));
    const suffix = String(match[2] || '').toLowerCase();
    if (suffix === 'k' || suffix === 'thousand' || suffix === 'grand') amount *= 1000;
    if (suffix === 'm') amount *= 1000000;
    if (Number.isFinite(amount)) found.add(String(amount));
  }
  const words = new RegExp(`\\b(${NUMBER_TOKEN})\\s+thousand\\b`, 'gi');
  while ((match = words.exec(source))) {
    const amount = numberToken(match[1]);
    if (Number.isFinite(amount)) found.add(String(amount * 1000));
  }
  return found;
}

function percentValues(text) {
  return [...percentFigures(text)].map(Number);
}

function dollarValues(text) {
  const values = [];
  const re = /\$\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\s*([kKmM])?/g;
  let match;
  while ((match = re.exec(String(text || '')))) {
    let amount = Number(match[1].replace(/,/g, ''));
    const suffix = String(match[2] || '').toLowerCase();
    if (suffix === 'k') amount *= 1000;
    if (suffix === 'm') amount *= 1000000;
    if (Number.isFinite(amount)) values.push(amount);
  }
  return values;
}

function isDollarRange(sentence) {
  return /\$\s*[\d,]+(?:\.\d+)?\s*[kKmM]?\s*(?:-|–|—|to|and)\s*\$?\s*[\d,]+(?:\.\d+)?\s*[kKmM]?/i.test(sentence);
}

function sentenceHasInventedFigure(sentence, allowedPercents, allowedMoney) {
  const percents = percentValues(sentence);
  if (percents.some(value => !allowedPercents.has(String(value)))) return true;
  if (!isDollarRange(sentence)) return false;
  const amounts = dollarValues(sentence);
  return amounts.length >= 2 && amounts.some(value => !allowedMoney.has(String(value)));
}

function scrubUnspokenFigures(value, transcript) {
  const text = textOrEmpty(value);
  if (!text || !textOrEmpty(transcript)) return text;
  const allowedPercents = percentFigures(transcript);
  const allowedMoney = moneyFigures(transcript);
  const parts = text.split(/(?<=[.!?])\s+/);
  return parts
    .filter(sentence => !sentenceHasInventedFigure(sentence, allowedPercents, allowedMoney))
    .join(' ')
    .trim();
}

function callerStance(finding = {}) {
  const raw = textOrEmpty(finding.callerStance || finding.disposition).toLowerCase().replace(/[\s-]+/g, '_');
  if (['handled', 'closed', 'strength', 'not_an_issue', 'not_a_problem', 'healthy'].includes(raw)) return 'handled';
  if (['not_discussed', 'undiscussed', 'not_mentioned', 'unknown', 'missing'].includes(raw)) return 'not_discussed';
  if (['problem', 'gap', 'unhandled', 'not_handled'].includes(raw)) return 'problem';
  return '';
}

function norm(value) {
  return textOrEmpty(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function mentionsArea(text, area) {
  const hay = ` ${norm(text)} `;
  const areaNorm = norm(area);
  if (!areaNorm) return false;
  if (hay.includes(` ${areaNorm} `)) return true;
  return areaNorm.split(' ').filter(word => word.length >= 4).some(word => {
    if (hay.includes(` ${word} `)) return true;
    if (word.length < 6) return false;
    return new RegExp(`\\b${word.slice(0, 6)}`).test(hay);
  });
}

function sameArea(left, right) {
  return norm(left) !== '' && norm(left) === norm(right);
}

// Drops closed topics from gaps and actions, and strips percentages or dollar ranges nobody stated.
function groundReport(report, transcript = '') {
  if (!report || typeof report !== 'object' || Array.isArray(report)) return report;
  const next = JSON.parse(JSON.stringify(report));
  const scrub = (value) => scrubUnspokenFigures(value, transcript);
  const findings = Array.isArray(next.diagnosticFindings) ? next.diagnosticFindings : [];
  const stances = findings.map(finding => ({ finding, stance: callerStance(finding) }));
  const anyStance = stances.some(item => item.stance);
  const problemAreas = stances.filter(item => item.stance === 'problem').map(item => item.finding.problemArea);
  const closedAreas = stances.filter(item => item.stance === 'handled' || item.stance === 'not_discussed').map(item => item.finding.problemArea);

  next.diagnosticFindings = stances
    .filter(item => item.stance !== 'not_discussed')
    .map(({ finding, stance }) => {
      const grounded = {
        ...finding,
        evidence: scrub(finding.evidence),
        maturity: scrub(finding.maturity),
        likelyImpact: scrub(finding.likelyImpact),
        fastestWin: scrub(finding.fastestWin),
      };
      if (stance === 'handled') {
        grounded.status = 'green';
        grounded.fastestWin = '';
      }
      return grounded;
    });

  if (!Array.isArray(next.keyStrengths)) next.keyStrengths = [];
  next.keyStrengths = next.keyStrengths.map(item => scrub(item)).filter(Boolean);
  for (const finding of next.diagnosticFindings) {
    if (callerStance(finding) !== 'handled') continue;
    const line = textOrEmpty(finding.evidence) || textOrEmpty(finding.maturity);
    if (!line) continue;
    if (!next.keyStrengths.some(item => norm(item) === norm(line))) next.keyStrengths.push(line);
  }

  const mentionsClosedOnly = (text) => {
    const mentionsProblem = problemAreas.some(area => mentionsArea(text, area));
    const mentionsClosed = closedAreas.some(area => mentionsArea(text, area));
    return mentionsClosed && !mentionsProblem;
  };

  if (Array.isArray(next.criticalGaps)) {
    next.criticalGaps = next.criticalGaps.map(item => scrub(item)).filter(Boolean);
    if (anyStance) {
      next.criticalGaps = next.criticalGaps.filter(gap => !mentionsClosedOnly(gap));
    }
  }

  if (Array.isArray(next.actionPlan)) {
    next.actionPlan = next.actionPlan
      .map(item => {
        if (typeof item === 'string') return scrub(item);
        if (!item || typeof item !== 'object') return item;
        return {
          ...item,
          action: scrub(item.action),
          expectedImpact: scrub(item.expectedImpact),
        };
      })
      .filter(item => {
        if (typeof item === 'string') return Boolean(textOrEmpty(item)) && (!anyStance || !mentionsClosedOnly(item));
        if (!item || typeof item !== 'object' || !textOrEmpty(item.action)) return false;
        if (!anyStance) return true;
        const area = textOrEmpty(item.problemArea);
        if (area) return problemAreas.some(problemArea => sameArea(problemArea, area));
        return !mentionsClosedOnly(item.action);
      });
  }

  if (next.priorityAnalysis && typeof next.priorityAnalysis === 'object') {
    for (const key of ['highestImpactIssue', 'fastestVisibleWin', 'reasoning']) {
      const cleaned = scrub(next.priorityAnalysis[key]);
      next.priorityAnalysis[key] = anyStance && mentionsClosedOnly(cleaned) ? '' : cleaned;
    }
  }

  if (next.sections && typeof next.sections === 'object') {
    for (const [key, value] of Object.entries(next.sections)) {
      if (typeof value === 'string') next.sections[key] = scrub(value);
    }
  }

  return next;
}

module.exports = {
  generate,
  parseJsonReport,
  callerFieldsFromReport,
  textOrEmpty,
  spokenMobile,
  confirmedMobileFromTranscript,
  confirmedPhoneNumber,
  groundReport,
};

