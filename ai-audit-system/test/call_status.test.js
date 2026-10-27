const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');

const storePath = path.join(os.tmpdir(), `ai-audit-call-status-${process.pid}.sqlite`);
process.env.CALL_STORE_PATH = storePath;

const callStore = require('../agents/call_store');
const cs = require('../agents/call_status');

test.beforeEach(() => { callStore.close(); if (fs.existsSync(storePath)) fs.unlinkSync(storePath); callStore.reload(); });
test.afterEach(() => { callStore.close(); if (fs.existsSync(storePath)) fs.unlinkSync(storePath); });

test('legacy records without callStatus read as New and are not rewritten', () => {
  callStore.close();
  const db = new Database(storePath);
  db.exec('CREATE TABLE IF NOT EXISTS calls (call_id TEXT PRIMARY KEY, updated_at TEXT NOT NULL, payload TEXT NOT NULL)');
  db.prepare('INSERT INTO calls VALUES (?, ?, ?)').run('legacy', '2026-10-20T00:00:00Z', JSON.stringify({ callId: 'legacy', status: 'report_ready' }));
  db.close();
  callStore.reload();
  assert.equal(callStore.get('legacy').callStatus, 'new');
  assert.equal(callStore.list()[0].callStatus, 'new');
  callStore.close();
  const raw = new Database(storePath, { readonly: true }).prepare('SELECT payload FROM calls').get();
  assert.equal(JSON.parse(raw.payload).callStatus, undefined);
});

test('list filters by status and deleteTestCalls removes only Test', () => {
  callStore.save('a', { callStatus: 'new' });
  callStore.save('b', { callStatus: 'test' });
  callStore.save('c', { callStatus: 'no_go' });
  callStore.save('d', { callStatus: 'test' });
  assert.deepEqual(callStore.list({ statuses: ['new', 'booked'] }).map(c => c.callId), ['a']);
  assert.deepEqual(callStore.countByStatus(), { new: 1, test: 2, no_go: 1 });
  assert.deepEqual(callStore.deleteTestCalls().sort(), ['b', 'd']);
  assert.deepEqual(callStore.list({ limit: 0 }).map(c => c.callId).sort(), ['a', 'c']);
});

test('hasSuccessfulIntroBooking reads tool_calls and transcript_with_tool_calls', () => {
  assert.equal(cs.hasSuccessfulIntroBooking({ tool_calls: [{ name: 'book_intro_appointment', success: true }] }), true);
  assert.equal(cs.hasSuccessfulIntroBooking({ tool_calls: [{ name: 'book_intro_appointment', success: false }] }), false);
  assert.equal(cs.hasSuccessfulIntroBooking({ tool_calls: [{ name: 'check_intro_availability', success: true }] }), false);
  assert.equal(cs.hasSuccessfulIntroBooking({ transcript_with_tool_calls: [
    { role: 'tool_call_invocation', name: 'book_calendly_appointment', tool_call_id: 'x' },
    { role: 'tool_call_result', tool_call_id: 'x', successful: true },
  ] }), true);
  assert.equal(cs.hasSuccessfulIntroBooking(null), false);
});

test('autoBookedPatch never overrides a manual status', () => {
  const booked = { tool_calls: [{ name: 'book_intro_appointment', success: true }] };
  assert.equal(cs.autoBookedPatch({ callStatus: 'new' }, booked).callStatus, 'booked');
  assert.equal(cs.autoBookedPatch(null, booked).callStatus, 'booked');
  assert.equal(cs.autoBookedPatch({ callStatus: 'test', callStatusSource: 'manual' }, booked), null);
  assert.equal(cs.autoBookedPatch({ callStatus: 'new', callStatusSource: 'manual' }, booked), null);
  assert.equal(cs.autoBookedPatch({ callStatus: 'new' }, { tool_calls: [] }), null);
});
