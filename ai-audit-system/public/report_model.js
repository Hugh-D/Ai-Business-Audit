/* Shared report model for the v4 customer Business Check and the internal Trades Readiness Audit.
   Used by the server (require) and the workbench (window.ReportModel). Pure functions only. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ReportModel = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
  const TAGS = {
    high: { glyph: '\u25B2', label: 'HIGH', style: 'solid' },
    medium: { glyph: '\u25CF', label: 'MEDIUM', style: 'outlined' },
    low: { glyph: '\u25CB', label: 'LOW', style: 'grey' },
  };
  const EFFORT = { quick_fix: 'Quick fix', this_month: 'This month', bigger_job: 'Bigger job' };
  const MAX_FINDINGS = 7;
  const MAX_WORDS = 15;

  // Plain trade words instead of jargon. Applied to every customer-facing line.
  const PLAIN = [
    [/\bAI agents?\b/gi, 'auto helper'],
    [/\b(?:a )?(?:simple |basic )?CRMs?\b/gi, 'a simple enquiry list'],
    [/\bconversions?\b/gi, 'jobs won'],
    [/\bconvert(s|ed|ing)?\b/gi, 'win$1'],
    [/\bleverag(e|es|ed|ing)\b/gi, 'use'],
    [/\boptimi[sz](e|es|ed|ing|ation)\b/gi, 'improve'],
    [/\b(deploy|implement)(s|ed|ing)?\b/gi, 'set up'],
    [/\butili[sz](e|es|ed|ing)\b/gi, 'use'],
    [/\bstreamlin(e|es|ed|ing)\b/gi, 'simplify'],
    [/\bworkflows?\b/gi, 'the way you do it'],
    [/\bbandwidth\b/gi, 'time'],
    [/\bprospects\b/gi, 'customers'],
    [/\btyre-kickers\b/gi, 'people just shopping around'],
    [/\bapproximately\b/gi, 'about'],
    [/\bimmediately\b/gi, 'straight away'],
  ];

  function clean(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function plain(value) {
    let out = clean(value)
      .replace(/(\d)\s*[\u2013\u2014]\s*(\$?\d)/g, '$1 to $2')
      .replace(/\s*[\u2014\u2013]\s*/g, ', ')
      .replace(/\u2026/g, '...');
    for (const [re, to] of PLAIN) out = out.replace(re, to);
    return out;
  }

  // Bullets are 15 words or fewer. Prefer ending at a natural break.
  function clip(value, max = MAX_WORDS) {
    const text = plain(value).replace(/\s+[\u2014\u2013-]\s+/g, ', ');
    const words = text.split(' ').filter(Boolean);
    if (words.length <= max) return text;
    const head = words.slice(0, max).join(' ');
    const cut = head.search(/[,;:.](?=[^,;:.]*$)/);
    const base = cut > head.length * 0.5 ? head.slice(0, cut) : head;
    return base.replace(/[,;:.\s]+$/, '') + '.';
  }

  function normPriority(value) {
    const v = clean(value).toLowerCase();
    return PRIORITY_ORDER[v] != null ? v : 'medium';
  }

  function normEffort(value) {
    const v = clean(value).toLowerCase().replace(/[\s-]+/g, '_');
    if (EFFORT[v]) return v;
    if (/quick|week|7/.test(v)) return 'quick_fix';
    if (/month|14|30/.test(v)) return 'this_month';
    if (/big|long|quarter/.test(v)) return 'bigger_job';
    return 'this_month';
  }

  function quoteFrom(text) {
    const m = clean(text).match(/['\u2018\u201C"]([^'\u2019\u201D"]{6,})['\u2019\u201D"]/);
    return m ? m[1].trim() : '';
  }

  // Money figures only when the call itself gave them. Returns e.g. "$5,000 to $10,000 a job".
  function moneyFrom(text, transcript) {
    const m = clean(text).match(/\$\s?[\d,.]+k?(?:\s*(?:\u2013|-|to)\s*\$?\s?[\d,.]+k?)?(?:\s+(?:a|per)\s+(?:job|week|month|year))?/i);
    if (!m) return '';
    const figure = m[0].replace(/\s*(\u2013|-)\s*/, ' to ');
    const digits = (figure.match(/[\d][\d,]*/g) || []).map(d => d.replace(/,/g, ''));
    const said = clean(transcript).replace(/,/g, '');
    const spoken = (d) => new RegExp(`(^|[^\\d.])(${d}|${Number(d) / 1000}\\s?(k|thousand|grand))(?![\\d])`, 'i').test(said);
    if (said && !digits.every(spoken)) return '';
    return figure;
  }

  function findingFromLegacy(f, report, transcript) {
    return {
      priority: normPriority(f.urgency),
      title: clip(f.problemArea, 8),
      found: f.maturity,
      whyItMatters: f.likelyImpact,
      doThisFirst: f.fastestWin,
      effort: { high: 'quick_fix', medium: 'this_month', low: 'bigger_job' }[clean(f.implementationPotential).toLowerCase()] || 'this_month',
      moneyAtStake: moneyFrom(f.likelyImpact, transcript),
      moneyRank: null,
      customerQuote: quoteFrom(f.evidence),
      evidence: f.evidence,
      confidence: clean(report.priorityAnalysis && report.priorityAnalysis.implementationConfidence) || 'medium',
      volveFix: f.fastestWin,
    };
  }

  function legacyCustomerReport(report, transcript) {
    const findings = (report.diagnosticFindings || [])
      .filter(f => f && clean(f.callerStance).toLowerCase() !== 'handled' && clean(f.status).toLowerCase() !== 'green')
      .map(f => findingFromLegacy(f, report, transcript));
    const summary = clean(report.sections && report.sections.executiveSummary);
    return {
      bottomLine: (report.priorityAnalysis && report.priorityAnalysis.highestImpactIssue) || summary.split(/(?<=\.)\s/)[0] || '',
      findings,
      whatsWorking: report.keyStrengths || [],
    };
  }

  function normFinding(f, index) {
    const extra = Array.isArray(f.extraBullets) ? f.extraBullets : (f.extra ? [f.extra] : []);
    return {
      priority: normPriority(f.priority),
      title: clip(f.title || f.problemArea || 'Finding', 8).replace(/\.$/, ''),
      bullets: [
        { label: 'What I found', text: clip(f.found) },
        { label: 'Why it matters', text: clip(f.whyItMatters) },
        { label: 'Do this first', text: clip(f.doThisFirst) },
        ...extra.slice(0, 2).map(t => ({ label: '', text: clip(t) })),
      ].filter(b => b.text),
      effort: normEffort(f.effort),
      effortLabel: EFFORT[normEffort(f.effort)],
      moneyAtStake: clean(f.moneyAtStake),
      moneyRank: Number.isFinite(Number(f.moneyRank)) && f.moneyRank !== null && f.moneyRank !== '' ? Number(f.moneyRank) : null,
      customerQuote: clean(f.customerQuote),
      evidence: clean(f.evidence || f.customerQuote),
      confidence: normPriority(f.confidence),
      volveFix: plain(f.volveFix || f.doThisFirst),
      tag: TAGS[normPriority(f.priority)],
      sourceIndex: index,
    };
  }

  function buildModel(audit = {}) {
    const report = audit.report || {};
    const transcript = audit.transcript || '';
    const source = report.customerReport && Array.isArray(report.customerReport.findings) && report.customerReport.findings.length
      ? report.customerReport
      : legacyCustomerReport(report, transcript);

    // Sort by priority in code too: High, Medium, Low, keeping the model's order inside a band.
    const findings = source.findings.map(normFinding)
      .sort((a, b) => (PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]) || (a.sourceIndex - b.sourceIndex))
      .slice(0, MAX_FINDINGS)
      .map((f, i) => ({ ...f, number: i + 1 }));

    // Top 3 fixes: money at stake first (model rank, then any estimate), then priority order.
    const topFixes = findings.slice()
      .sort((a, b) => {
        const ra = a.moneyRank != null ? a.moneyRank : (a.moneyAtStake ? 50 : 100);
        const rb = b.moneyRank != null ? b.moneyRank : (b.moneyAtStake ? 50 : 100);
        return (ra - rb) || (a.number - b.number);
      })
      .slice(0, 3)
      .map((f, i) => ({
        rank: i + 1,
        number: f.number,
        title: f.title,
        action: f.bullets.find(b => b.label === 'Do this first')?.text || '',
        estimate: f.moneyAtStake ? `Estimate from our call: ${f.moneyAtStake}` : '',
      }));

    const score = Number(report.overallScore);
    return {
      businessName: clean(audit.businessName || report.businessName) || 'Your business',
      contactName: clean(audit.contactName || report.contactName),
      industry: clean(audit.industry),
      callId: clean(audit.callId || audit.auditId),
      date: audit.date || new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Sydney' }),
      score: Number.isFinite(score) ? score : null,
      scores: report.scores || {},
      bottomLine: clip(source.bottomLine, 25),
      topFixes,
      findings,
      whatsWorking: (source.whatsWorking || []).map(s => clip(s)).filter(Boolean).slice(0, 3),
      reviewedBy: 'Hugh Douglas',
      notes: {
        reviewNotes: clean(audit.reviewNotes),
        deliveryNotes: clean(audit.deliveryNotes),
        followUpNotes: clean(audit.followUpNotes),
      },
    };
  }

  function wordCount(text) {
    return clean(text).split(' ').filter(Boolean).length;
  }

  return { buildModel, clip, plain, TAGS, EFFORT, PRIORITY_ORDER, MAX_FINDINGS, MAX_WORDS, wordCount, moneyFrom };
}));
