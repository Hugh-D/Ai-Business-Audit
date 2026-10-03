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
    followUpStatus: 'declined',
    followUpPreferredTime: '',
  });

  assert.equal(callerFieldsFromReport({ followUpStatus: 'requested' }).followUpStatus, 'requested');
  assert.equal(callerFieldsFromReport({}).followUpStatus, '');
  assert.equal(callerFieldsFromReport({ followUpStatus: 'completed' }).followUpStatus, '');
  assert.equal(callerFieldsFromReport({ email: 'from-report@example.com' }).recipientEmail, 'from-report@example.com');
});
