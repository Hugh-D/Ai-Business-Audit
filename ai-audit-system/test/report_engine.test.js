const test = require('node:test');
const assert = require('node:assert/strict');

const { parseJsonReport } = require('../agents/report_engine');

test('parseJsonReport parses raw JSON', () => {
  const report = parseJsonReport('{"overallScore":8,"keyStrengths":["fast response"]}');

  assert.equal(report.overallScore, 8);
  assert.deepEqual(report.keyStrengths, ['fast response']);
});

test('parseJsonReport parses fenced JSON blocks', () => {
  const report = parseJsonReport([
    'Here is the report:',
    '```json',
    '{"overallScore":7,"criticalGaps":["missed follow-up"]}',
    '```',
  ].join('\n'));

  assert.equal(report.overallScore, 7);
  assert.deepEqual(report.criticalGaps, ['missed follow-up']);
});

test('parseJsonReport extracts JSON surrounded by prose', () => {
  const report = parseJsonReport('prefix {"overallScore":6,"sections":{"leads":"Leads are scattered."}} suffix');

  assert.equal(report.overallScore, 6);
  assert.equal(report.sections.leads, 'Leads are scattered.');
});

test('parseJsonReport throws a clear error when JSON cannot be found', () => {
  assert.throws(
    () => parseJsonReport('No structured report here.'),
    /not valid JSON/
  );
});

const { callerFieldsFromReport } = require('../agents/report_engine');

test('callerFieldsFromReport keeps spoken follow-up timing and drops invented timestamps', () => {
  assert.deepEqual(callerFieldsFromReport({
    contactName: ' John ',
    businessName: "John's Kitchen Cupboards and Carpentry",
    recipientEmail: 'john@example.com',
    followUpStatus: 'booked',
    followUpPreferredTime: 'Thursday at 1',
  }), {
    contactName: 'John',
    businessName: "John's Kitchen Cupboards and Carpentry",
    recipientEmail: 'john@example.com',
    phoneNumber: '',
    followUpStatus: 'booked',
    followUpPreferredTime: 'Thursday at 1',
  });

  assert.equal(callerFieldsFromReport({
    followUpStatus: 'booked',
    followUpPreferredTime: 'Monday',
  }).followUpPreferredTime, 'Monday');

  assert.deepEqual(callerFieldsFromReport({
    followUpStatus: 'Booked',
    followUpPreferredTime: 'Thursday at 1',
  }), {
    contactName: '',
    businessName: '',
    recipientEmail: '',
    phoneNumber: '',
    followUpStatus: 'booked',
    followUpPreferredTime: 'Thursday at 1',
  });

  const invented = callerFieldsFromReport({
    followUpStatus: 'booked',
    followUpPreferredTime: '2026-10-08T13:00:00',
  });
  assert.equal(invented.followUpStatus, 'booked');
  assert.equal(invented.followUpPreferredTime, '');
});

test('callerFieldsFromReport leaves follow-up time blank unless a day or time was booked', () => {
  assert.deepEqual(callerFieldsFromReport({
    followUpStatus: 'declined',
    followUpPreferredTime: 'Thursday at 1',
  }), {
    contactName: '',
    businessName: '',
    recipientEmail: '',
    phoneNumber: '',
    followUpStatus: 'declined',
    followUpPreferredTime: '',
  });

  assert.equal(callerFieldsFromReport({ followUpStatus: 'requested' }).followUpStatus, 'requested');
  assert.equal(callerFieldsFromReport({}).followUpStatus, '');
  assert.equal(callerFieldsFromReport({ followUpStatus: 'completed' }).followUpStatus, '');
  assert.equal(callerFieldsFromReport({ email: 'from-report@example.com' }).recipientEmail, 'from-report@example.com');
});

const { spokenMobile, confirmedPhoneNumber, groundReport } = require('../agents/report_engine');

test('spokenMobile keeps a confirmed Australian mobile and ignores anything else', () => {
  assert.equal(spokenMobile('0474 779 497'), '0474 779 497');
  assert.equal(spokenMobile('+61 474 779 497'), '0474 779 497');
  assert.equal(spokenMobile('+61474779711'), '0474 779 711');
  assert.equal(spokenMobile(''), '');
  assert.equal(spokenMobile('02 5700 0037'), '');
});

test('confirmedPhoneNumber uses a read-back mobile and ignores a number the caller did not say', () => {
  const transcript = [
    'Agent: What is the best mobile for the report?',
    'Agent: I have that as 0474 779 497. Is that right?',
    'Caller: Yes.',
  ].join('\n');

  assert.equal(confirmedPhoneNumber({
    report: { phoneNumber: '+61474779711' },
    transcript,
  }), '0474 779 497');

  assert.equal(confirmedPhoneNumber({
    report: { phoneNumber: '' },
    transcript,
  }), '0474 779 497');

  assert.equal(confirmedPhoneNumber({
    report: { phoneNumber: '0499 111 222' },
    transcript: 'Caller: I will text you later.',
  }), '');

  assert.equal(confirmedPhoneNumber({
    report: { mobile: '0474 779 497' },
    transcript: '',
  }), '0474 779 497');
});

test('groundReport keeps handled topics as strengths and drops invented ranges', () => {
  const transcript = [
    'Caller: I chase every missed enquiry and I follow every quote.',
    'Caller: I record extras daily and invoice immediately. Double entry is not an issue.',
    'Caller: Quoting sits with me, and we do not ask for Google reviews.',
    'Caller: There is about twenty-two thousand unpaid, but that is not a problem.',
    'Caller: Leaks are not much.',
  ].join('\n');

  const grounded = groundReport({
    keyStrengths: [],
    criticalGaps: [
      'Lead handling has no safety net',
      'No CRM or conversion tracking',
      'Google reviews are not requested',
    ],
    diagnosticFindings: [
      {
        problemArea: 'Lead Response',
        callerStance: 'handled',
        status: 'yellow',
        evidence: 'He chases every missed enquiry.',
        fastestWin: 'Add a safety net for missed calls.',
      },
      {
        problemArea: 'Lead Ownership',
        callerStance: 'handled',
        status: 'red',
        evidence: 'He follows up the leads himself.',
        fastestWin: 'Name a backup owner.',
      },
      {
        problemArea: 'Quote Follow-Up',
        callerStance: 'handled',
        status: 'yellow',
        evidence: 'He follows every quote.',
        fastestWin: 'Add quote reminders.',
      },
      {
        problemArea: 'Double Handling',
        callerStance: 'handled',
        status: 'yellow',
        evidence: 'Double entry is not an issue.',
        fastestWin: 'Stop re-entering jobs.',
      },
      {
        problemArea: 'Quote Conversion Tracking',
        callerStance: 'not_discussed',
        status: 'red',
        evidence: 'No CRM was mentioned.',
        fastestWin: 'Add a CRM.',
      },
      {
        problemArea: 'Collections',
        callerStance: 'not_discussed',
        status: 'red',
        evidence: 'He mentioned $22,000 unpaid.',
        fastestWin: 'Chase the unpaid invoices.',
        likelyImpact: 'That is 2-3% of turnover.',
      },
      {
        problemArea: 'Reviews and Reputation',
        callerStance: 'problem',
        status: 'yellow',
        evidence: 'They do not ask for Google reviews.',
        fastestWin: 'Ask after the job.',
      },
      {
        problemArea: 'Owner Dependence',
        callerStance: 'problem',
        status: 'yellow',
        evidence: 'Quoting sits with the owner. Jobs are often $22,000.',
        fastestWin: 'Write down how he quotes.',
        likelyImpact: 'Worth 2-3% of turnover.',
      },
    ],
    actionPlan: [
      { problemArea: 'Lead Response', action: 'Add a safety net for missed calls.', priority: 'high' },
      { problemArea: 'Quote Conversion Tracking', action: 'Track conversion in a CRM.', priority: 'medium' },
      { problemArea: 'Collections', action: 'Chase the $22,000 unpaid.', priority: 'high' },
      { problemArea: 'Reviews and Reputation', action: 'Ask for a Google review after each job.', priority: 'medium' },
      {
        problemArea: 'Owner Dependence',
        action: 'Reduce owner-only quoting.',
        priority: 'high',
        expectedImpact: 'Worth 2-3% of turnover. Keep the spoken $22,000 job size.',
      },
    ],
    priorityAnalysis: {
      highestImpactIssue: 'Lead handling has no safety net, about 2-3% of turnover.',
      fastestVisibleWin: 'Collect the $22,000.',
      reasoning: 'Quoting sits with the owner.',
    },
  }, transcript);

  assert.deepEqual(grounded.diagnosticFindings.map(item => item.problemArea), [
    'Lead Response',
    'Lead Ownership',
    'Quote Follow-Up',
    'Double Handling',
    'Reviews and Reputation',
    'Owner Dependence',
  ]);
  assert.equal(grounded.diagnosticFindings[0].status, 'green');
  assert.equal(grounded.diagnosticFindings[0].fastestWin, '');
  assert.equal(grounded.diagnosticFindings[5].likelyImpact, '');
  assert.match(grounded.diagnosticFindings[5].evidence, /\$22,000/);
  assert.ok(grounded.keyStrengths.includes('He chases every missed enquiry.'));
  assert.deepEqual(grounded.criticalGaps, ['Google reviews are not requested']);
  assert.deepEqual(grounded.actionPlan.map(item => item.problemArea), [
    'Reviews and Reputation',
    'Owner Dependence',
  ]);
  assert.equal(grounded.actionPlan[1].expectedImpact, 'Keep the spoken $22,000 job size.');
  assert.equal(grounded.priorityAnalysis.highestImpactIssue, '');
  assert.equal(grounded.priorityAnalysis.fastestVisibleWin, '');
  assert.equal(grounded.priorityAnalysis.reasoning, 'Quoting sits with the owner.');
});

test('groundReport leaves a report alone when the caller did not label topics', () => {
  const report = {
    criticalGaps: ['Missed after-hours calls'],
    diagnosticFindings: [
      { problemArea: 'Lead Response', status: 'red', evidence: 'Calls go to voicemail.' },
    ],
    actionPlan: [{ action: 'Text back the same day.', problemArea: 'Lead Response' }],
  };

  const grounded = groundReport(report, 'Caller: Calls go to voicemail.');
  assert.equal(grounded.diagnosticFindings[0].status, 'red');
  assert.deepEqual(grounded.criticalGaps, ['Missed after-hours calls']);
  assert.equal(grounded.actionPlan[0].action, 'Text back the same day.');
  assert.equal(report.diagnosticFindings[0].status, 'red');
});
