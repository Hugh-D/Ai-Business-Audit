const test = require('node:test');
const assert = require('node:assert/strict');

const reportPdf = require('../agents/report_pdf');

test('buildTwoPageModel maps engine JSON into the two-page report and skips money claims', () => {
  const model = reportPdf.buildTwoPageModel({
    industry: 'trades',
    businessName: "Harry's Electrical",
    contactName: 'Harry',
    phoneNumber: '0474 779 711',
    recipientEmail: 'owner@example.com',
    reviewNotes: 'Internal only. Do not print this note.',
    deliveryNotes: 'Internal handoff note.',
    followUpPreferredTime: 'Any day after 3pm',
    report: {
      overallScore: 3.6,
      sections: {
        executiveSummary: 'Harry runs the quotes and the invoices.\n\nSecond paragraph should stay off the cover lede. A slipped enquiry is not a $10,000 job.',
        leadHandlingBooking: 'This later section is not the cover lede.',
      },
      criticalGaps: ['Unused gap because diagnostics exist'],
      priorityAnalysis: {
        highestImpactIssue: 'About 5 or 6 enquiries slip through a typical week.',
        fastestVisibleWin: 'Same-day capture of missed calls.',
        reasoning: 'The process is already visible. A weekly case would be $520,000 a year.',
      },
      diagnosticFindings: [
        {
          problemArea: 'Reviews and Reputation',
          status: 'green',
          urgency: 'low',
          evidence: 'Customers already refer the business.',
          fastestWin: 'Ask when the invoice goes out.',
          likelyImpact: '$200,000 unpaid is not this finding.',
        },
        {
          problemArea: 'Quote Follow-Up',
          status: 'yellow',
          urgency: 'high',
          evidence: 'Follow-up is hit and miss. No win rate was given, so this is not a $40,000 claim.',
          maturity: 'Memory-based follow-up.',
          fastestWin: 'Set a due date when the quote goes out.',
          likelyImpact: 'Quotes go cold.',
        },
        {
          problemArea: 'Lead Response',
          status: 'red',
          urgency: 'medium',
          evidence: 'About 5 or 6 enquiries slip through a typical week.',
          fastestWin: 'Name a backup for the phone.',
        },
        {
          problemArea: 'Job Profitability',
          status: 'red',
          urgency: 'high',
          evidence: 'Extras are often left off the invoice - $2.5 million turnover makes this look large.',
          maturity: 'Extras are often left off the invoice.',
          fastestWin: 'Write the extra down before leaving site.',
        },
      ],
      actionPlan: [
        { priority: 'low', action: 'Ask for a review when the invoice goes out.', timeframe: 'within 30 days', problemArea: 'Reviews and Reputation' },
        { priority: 'high', action: 'Give every missed call a same-day callback.', timeframe: 'within 7 days', problemArea: 'Lead Response', expectedImpact: 'Worth $120,000 a year.' },
        { priority: 'high', action: 'Invoice extras with the job. A $20,000 illustration only.', timeframe: 'within 14 days', problemArea: 'Job Profitability' },
      ],
    },
  });

  assert.equal(model.preparedFor, "Harry's Electrical");
  assert.equal(model.industryLabel, 'Trades & Home Services');
  assert.equal(model.scoreLabel, '3.6/10');
  assert.equal(model.findingCount, 3);
  // Strengths never sit in the "fix" list; they move to "Doing well".
  assert.deepEqual(model.findings.map((item) => item.title), [
    'Missed calls and enquiries',
    'Money left on the job',
    'Following up quotes',
  ]);
  assert.equal(model.findings[0].status, 'red');
  assert.equal(model.findings[0].currentState, 'About 5 or 6 enquiries slip through a typical week.');
  assert.equal(model.findings[1].currentState, 'Extras are often left off the invoice.');
  assert.equal(model.findings[2].status, 'yellow');
  assert.equal(model.findings[1].fastestWin, 'Write the extra down before leaving site.');
  assert.equal(model.doingWell[0].title, 'Google reviews');
  assert.equal(model.doingWell[0].text, 'Customers already refer the business.');
  assert.equal(model.brand.phone, '(02) 5700 0037');
  assert.equal(model.headline, 'About 5 or 6 enquiries slip through a typical week.');
  assert.match(model.lede, /Harry runs the quotes/);
  assert.doesNotMatch(model.lede, /Second paragraph|\$10,000/);
  assert.equal(model.reasoning, 'The process is already visible.');
  assert.deepEqual(model.actions.map((item) => item.action), [
    'Give every missed call a same-day callback.',
    'Invoice extras with the job.',
    'Ask for a review when the invoice goes out.',
  ]);
  assert.equal(model.actions[0].timeframe, 'within 7 days');
  assert.equal(model.firstAction, 'Within 7 days');
  assert.equal(model.followUpPreferredTime, 'Any day after 3pm');
  assert.equal(JSON.stringify(model).includes('Internal only'), false);
  assert.equal(JSON.stringify(model).includes('0474'), false);
  assert.equal(JSON.stringify(model).includes('$'), false);
  assert.equal(JSON.stringify(model).includes('likelyImpact'), false);
  assert.doesNotMatch(model.deck, /—|–/);
});

test('buildTwoPageModel uses critical gaps only when diagnostics are missing', () => {
  const model = reportPdf.buildTwoPageModel({
    industry: 'not_a_real_industry',
    contactName: 'Sam',
    report: {
      overallScore: 8,
      criticalGaps: ['Missed after-hours calls', 'No quote follow-up'],
      actionPlan: ['Follow up faster.'],
    },
  });

  assert.equal(model.preparedFor, 'Sam');
  assert.equal(model.industryLabel, 'Not A Real Industry');
  assert.equal(model.scoreLabel, '8/10');
  assert.deepEqual(model.findings, [
    { title: 'Missed after-hours calls', status: '', currentState: '', fastestWin: '' },
    { title: 'No quote follow-up', status: '', currentState: '', fastestWin: '' },
  ]);
  assert.deepEqual(model.actions, [{ action: 'Follow up faster.', timeframe: '', problemArea: '' }]);
  assert.equal(model.firstAction, '');
});

test('buildReportPdfBuffer renders two Inter pages and keeps internal notes out', async () => {
  const buffer = await reportPdf.buildReportPdfBuffer({
    auditId: 'call_deliver',
    industry: 'trades',
    businessName: 'Demo Plumbing Co',
    reviewNotes: 'Secret internal review note',
    report: {
      overallScore: 8,
      priorityAnalysis: { highestImpactIssue: 'Missed after-hours calls' },
      diagnosticFindings: [
        { problemArea: 'Lead Response', status: 'red', evidence: 'Calls go to voicemail.', fastestWin: 'Text back the same day.' },
      ],
      actionPlan: [{ priority: 'high', action: 'Follow up faster.', timeframe: 'within 7 days' }],
    },
  });

  assert.equal(reportPdf.buildReportFilename({ industry: 'trades', auditId: 'call_deliver' }), 'trades-call-deliver.pdf');
  assert.equal(buffer.subarray(0, 5).toString(), '%PDF-');
  assert.ok(buffer.length > 8000);
  const raw = buffer.toString('latin1');
  assert.equal((raw.match(/\/Type \/Page(?!s)/g) || []).length, 2);
  assert.match(raw, /Inter/);
  assert.match(raw, /Demo Plumbing Co/);
  assert.doesNotMatch(raw, /Secret internal review note|DM Serif|workbook/);
  assert.doesNotMatch(raw, /\u2014|\u2013|\u2026/);
  assert.match(raw, /Volve Solutions/);
  assert.doesNotMatch(raw, /Readiness Report|Executive diagnosis|AI Business Audit\)/);
});

test('a "when I am available" answer is not rated as doing well', () => {
  const model = reportPdf.buildTwoPageModel({
    businessName: 'PKR Climate',
    report: {
      overallScore: 4.8,
      strengths: ["Logan said 'I do when I am available' for chasing enquiries."],
      diagnosticFindings: [
        { problemArea: 'Lead Follow-Up', status: 'green', evidence: "Logan said 'I do when I am available' for chasing enquiries.", maturity: 'Follows up when he is available.' },
        { problemArea: 'Lead Response', status: 'yellow', evidence: "Logan calls back 'pretty quickly,' but also confirmed about 5 enquiries slip through per week." },
      ],
    },
  });
  const followUp = model.findings.find((item) => item.title === 'Chasing up enquiries');
  assert.equal(followUp.status, 'yellow');
  assert.equal(model.doingWell.length, 0);
  const response = model.findings.find((item) => item.title === 'Missed calls and enquiries');
  assert.equal(response.currentState, 'Logan also confirmed about 5 enquiries slip through per week.');
});

test('long Logan-style text fits on two pages without ellipses', async () => {
  const long = 'Introduce a short qualifying intake - either a form on the website or a scripted set of questions asked before any site visit is booked - to filter job type, location, budget readiness, and timeline before the owner commits quoting time.';
  const buffer = await reportPdf.buildReportPdfBuffer({
    businessName: 'Long Text Pty Ltd',
    report: {
      overallScore: 4.8,
      priorityAnalysis: { highestImpactIssue: long, fastestVisibleWin: long, reasoning: `${long} ${long}` },
      diagnosticFindings: [1, 2, 3, 4].map((n) => ({ problemArea: `Area ${n}`, status: 'red', evidence: long, fastestWin: long })),
      actionPlan: [1, 2, 3].map(() => ({ priority: 'high', action: long, timeframe: 'Within 14 days' })),
      strengths: ['Zero unpaid invoices.', 'Variations are captured on site.', 'Strong word of mouth.'],
    },
  });
  const raw = buffer.toString('latin1');
  assert.equal((raw.match(/\/Type \/Page(?!s)/g) || []).length, 2);
  assert.doesNotMatch(raw, /\u2026/);
});
