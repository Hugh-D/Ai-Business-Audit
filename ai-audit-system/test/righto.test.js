const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

const righto = require('../agents/righto');

const customers = [{ id: 'c1', businessName: 'Test Sparky', retellAgentIds: ['agent_righto'], phoneNumbers: ['+61400000000'], smsToEnv: 'R_SMS', emailToEnv: 'R_EMAIL' }];
const call = (over = {}) => ({
  call_id: 'call_' + Math.random().toString(36).slice(2), agent_id: 'agent_righto', direction: 'inbound', from_number: '+61411111111',
  call_analysis: { call_summary: 'Caller needs downlights.', custom_analysis_data: { caller_name: 'Sarah', callback_number: '0411111111', suburb: 'Picton', job_description: '6 downlights', urgency: 'flexible', preferred_time: 'next week mornings' } },
  ...over,
});
const okFetch = calls => async (url, opts) => { calls.push({ url, opts }); return { ok: true, status: 200, json: async () => ({ id: 'em_1', sid: 'SM1' }) }; };
const sleep = async () => {};
const quiet = { log() {} };
const mem = new Map();
const store = { get: id => mem.get(id) || null, save: (id, cid, e) => mem.set(id, { ...e, customerId: cid }) };

test('never matches Elle calls', () => {
  assert.equal(righto.findCustomer({ agent_id: righto.ELLE_AGENT_ID, to_number: '+61400000000' }, customers), null);
  assert.equal(righto.findCustomer({ agent_id: 'agent_other' }, customers), null);
  assert.equal(righto.findCustomer({ agent_id: 'agent_righto' }, customers).id, 'c1');
});

test('Elle call is not handled', async () => {
  const r = await righto.handleEvent({ event: 'call_analyzed', call: call({ agent_id: righto.ELLE_AGENT_ID }) }, { store, customers, env: {} });
  assert.equal(r.handled, false);
});

test('only call_analyzed sends', async () => {
  const sent = [];
  const r = await righto.handleEvent({ event: 'call_ended', call: call() }, { store, customers, env: { RESEND_API_KEY: 'k' }, fetchImpl: okFetch(sent) });
  assert.equal(r.skipped, 'call_ended');
  assert.equal(sent.length, 0);
});

test('sends email and skips sms without Twilio creds, logs once', async () => {
  const sent = [];
  const c = call();
  const env = { RESEND_API_KEY: 'k', R_EMAIL: 'owner@example.com' };
  const r = await righto.handleEvent({ event: 'call_analyzed', call: c }, { store, customers, env, fetchImpl: okFetch(sent), log: quiet });
  assert.equal(r.status, 'sent');
  assert.equal(r.sms.skipped, 'no credentials');
  assert.equal(sent.length, 1);
  assert.match(sent[0].url, /resend/);
  assert.match(JSON.parse(sent[0].opts.body).text, /Sarah/);
  assert.equal(store.get(c.call_id).status, 'sent');
  const again = await righto.handleEvent({ event: 'call_analyzed', call: c }, { store, customers, env, fetchImpl: okFetch(sent) });
  assert.equal(again.duplicate, true);
  assert.equal(sent.length, 1);
});

test('sends sms via Twilio when configured', async () => {
  const sent = [];
  const env = { RESEND_API_KEY: 'k', TWILIO_ACCOUNT_SID: 'AC1', TWILIO_AUTH_TOKEN: 't', TWILIO_FROM: 'VOLVE', R_SMS: '+61422222222' };
  const r = await righto.handleEvent({ event: 'call_analyzed', call: call() }, { store, customers, env, fetchImpl: okFetch(sent) });
  assert.equal(r.sms.ok, true);
  assert.ok(sent.some(s => /twilio/.test(s.url)));
});

test('dry run sends nothing', async () => {
  const sent = [];
  const r = await righto.handleEvent({ event: 'call_analyzed', call: call() }, { store, customers, env: { RESEND_API_KEY: 'k', RIGHTO_DRY_RUN: 'true' }, fetchImpl: okFetch(sent) });
  assert.equal(r.status, 'dry_run');
  assert.equal(sent.length, 0);
});

test('retries on 5xx then records error', async () => {
  let n = 0;
  const failFetch = async () => { n++; return { ok: false, status: 503, json: async () => ({ message: 'down' }) }; };
  const r = await righto.handleEvent({ event: 'call_analyzed', call: call() }, { store, customers, env: { RESEND_API_KEY: 'k' }, fetchImpl: failFetch, sleep, log: quiet });
  assert.equal(n, 3);
  assert.equal(r.status, 'partial_error');
});

test('emergency SMS is flagged', () => {
  const x = righto.extractDetails(call({ call_analysis: { custom_analysis_data: { caller_name: 'Bob', is_emergency: true } } }));
  assert.match(righto.buildSms(customers[0], x), /^URGENT JOB/);
});

test('shipped customer list has the test agent and not Elle', () => {
  const list = righto.loadCustomers();
  assert.ok(list.some(c => c.retellAgentIds.includes('agent_a248b5cd96684035e931f897d2')));
  assert.ok(!list.some(c => c.retellAgentIds.includes(righto.ELLE_AGENT_ID)));
});

