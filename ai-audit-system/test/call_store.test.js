const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const storePath = path.join(os.tmpdir(), `ai-audit-call-store-${process.pid}.json`);
process.env.CALL_STORE_PATH = storePath;

const callStore = require('../agents/call_store');

test.beforeEach(() => {
  if (fs.existsSync(storePath)) fs.unlinkSync(storePath);
  callStore.reload();
});

test.afterEach(() => {
  callStore.clear();
  if (fs.existsSync(storePath)) fs.unlinkSync(storePath);
});

test('save persists calls to disk', () => {
  callStore.save('call_disk', {
    status: 'registered',
    industry: 'trades',
    transcript: 'Client: We miss calls.',
  });

  const saved = JSON.parse(fs.readFileSync(storePath, 'utf8'));

  assert.equal(saved.length, 1);
  assert.equal(saved[0].callId, 'call_disk');
  assert.equal(saved[0].industry, 'trades');
  assert.ok(saved[0].updatedAt);
});

test('reload restores calls from disk', () => {
  callStore.save('call_reload', {
    status: 'report_ready',
    industry: 'lawn_care',
    report: { overallScore: 8 },
  });

  callStore.reload();

  assert.equal(callStore.get('call_reload').status, 'report_ready');
  assert.equal(callStore.get('call_reload').report.overallScore, 8);
});

test('clear removes calls from memory and disk', () => {
  callStore.save('call_clear', { status: 'registered' });

  callStore.clear();

  assert.deepEqual(callStore.list(), []);
  assert.deepEqual(JSON.parse(fs.readFileSync(storePath, 'utf8')), []);
});
