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
