const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');

const storePath = path.join(os.tmpdir(), `ai-audit-call-store-${process.pid}.sqlite`);
process.env.CALL_STORE_PATH = storePath;

const callStore = require('../agents/call_store');

test.beforeEach(() => {
  callStore.close();
  if (fs.existsSync(storePath)) fs.unlinkSync(storePath);
  callStore.reload();
});

test.afterEach(() => {
  callStore.clear();
  callStore.close();
  if (fs.existsSync(storePath)) fs.unlinkSync(storePath);
});

test('save persists calls to SQLite', () => {
  callStore.save('call_disk', {
    status: 'registered',
    industry: 'trades',
    transcript: 'Client: We miss calls.',
  });
  callStore.close();

  const db = new Database(storePath, { readonly: true });
  const saved = db.prepare('SELECT call_id, payload FROM calls WHERE call_id = ?').get('call_disk');
  db.close();

  const payload = JSON.parse(saved.payload);
  assert.equal(saved.call_id, 'call_disk');
  assert.equal(payload.callId, 'call_disk');
  assert.equal(payload.industry, 'trades');
  assert.ok(payload.updatedAt);
});

test('reload restores calls from SQLite', () => {
  callStore.save('call_reload', {
    status: 'report_ready',
    industry: 'lawn_care',
    report: { overallScore: 8 },
  });

  callStore.reload();

  assert.equal(callStore.get('call_reload').status, 'report_ready');
  assert.equal(callStore.get('call_reload').report.overallScore, 8);
});

test('clear removes calls from SQLite', () => {
  callStore.save('call_clear', { status: 'registered' });

  callStore.clear();
  callStore.close();

  const db = new Database(storePath, { readonly: true });
  const count = db.prepare('SELECT COUNT(*) AS count FROM calls').get().count;
  db.close();

  assert.deepEqual(callStore.list(), []);
  assert.equal(count, 0);
});
