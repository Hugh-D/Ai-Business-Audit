// Volve Righto (TEST): post-call job alerts for the ready-made receptionist.
// Only calls from agents listed in config/righto_customers.json reach this code.
// Elle (the audit agent) is never listed, so her webhook path is unchanged.
const fs = require('fs');
const path = require('path');
const delivery = require('./delivery_agent');

const CUSTOMERS_PATH = path.join(__dirname, '..', 'config', 'righto_customers.json');
const ELLE_AGENT_ID = 'agent_d2b88a467c67ff42d74bbb5e5f';

let db = null;
let dbPath = null;

function loadCustomers(file = CUSTOMERS_PATH) {
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(data.customers) ? data.customers : [];
  } catch (_err) {
    return [];
  }
}

function findCustomer(call = {}, customers = loadCustomers()) {
  if (!call || call.agent_id === ELLE_AGENT_ID) return null;
  return customers.find(c =>
    (c.retellAgentIds || []).includes(call.agent_id) ||
    (call.to_number && (c.phoneNumbers || []).includes(call.to_number))
  ) || null;
}

function usable(v) {
  const s = String(v || '').trim();
  return Boolean(s) && !/^your_|changeme|placeholder/i.test(s);
}

function recipients(customer, env = process.env) {
  const sms = usable(env[customer.smsToEnv]) ? String(env[customer.smsToEnv]).trim() : null;
  const email = usable(env[customer.emailToEnv]) ? String(env[customer.emailToEnv]).trim() : delivery.getReviewEmail(env);
  return { sms, email };
}

function cleanNumber(v) {
  const s = String(v == null ? '' : v).trim();
  return /\d{6,}/.test(s.replace(/[\s()-]/g, '')) ? s : '';
}

function extractDetails(call = {}) {
  const a = call.call_analysis || {};
  const d = a.custom_analysis_data || {};
  return {
    callerName: d.caller_name || '',
    callbackNumber: cleanNumber(d.callback_number) || cleanNumber(call.from_number) || '',
    callbackSameAsCaller: d.callback_same_as_caller === true,
    callbackNote: cleanNumber(d.callback_number) || cleanNumber(call.from_number) ? '' :
      (d.callback_same_as_caller === true ? 'caller said "same number" but there was no caller ID' : 'not given') +
      (call.call_type === 'web_call' ? ' (web call)' : ''),
    suburb: d.suburb || '',
    job: d.job_description || a.call_summary || '',
    urgency: d.urgency || (d.is_emergency ? 'emergency' : 'unknown'),
    preferredTime: d.preferred_time || '',
    isEmergency: d.is_emergency === true || d.urgency === 'emergency',
    isSpam: d.is_spam === true,
    summary: a.call_summary || '',
  };
}

function buildSms(customer, x) {
  const head = x.isEmergency ? 'URGENT JOB' : x.isSpam ? 'Spam/sales call' : 'NEW JOB';
  const parts = [
    `${head}: ${x.callerName || 'Unknown caller'} ${x.callbackNumber || ''}`.trim(),
    [x.suburb, x.job].filter(Boolean).join(': '),
    x.preferredTime ? `Wants: ${x.preferredTime}` : '',
    `- Righto for ${customer.businessName}`,
  ].filter(Boolean);
  return parts.join('. ').slice(0, 300);
}

function buildEmail(customer, x, call = {}) {
  const tag = x.isEmergency ? '[URGENT] ' : x.isSpam ? '[Spam?] ' : '';
  const subject = `${tag}New enquiry: ${x.callerName || 'Unknown caller'}${x.suburb ? ', ' + x.suburb : ''}`;
  const lines = [
    `New enquiry taken by Righto for ${customer.businessName}.`,
    '',
    `Name: ${x.callerName || '-'}`,
    `Callback number: ${x.callbackNumber || (x.callbackNote ? '- ' + x.callbackNote : '-')}`,
    `Suburb: ${x.suburb || '-'}`,
    `Job: ${x.job || '-'}`,
    `Urgency: ${x.urgency}${x.isEmergency ? ' (EMERGENCY)' : ''}`,
    `Preferred time: ${x.preferredTime || '-'}`,
    '',
    `Summary: ${x.summary || '-'}`,
    '',
    `Call ID: ${call.call_id || '-'}`,
  ];
  if (call.recording_url) lines.push(`Recording: ${call.recording_url}`);
  if (customer.test) lines.push('', 'TEST: this came from the Righto test agent.');
  return { subject, text: lines.join('\n') };
}

async function withRetry(fn, { attempts = 3, delayMs = 1000, sleep = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try { return { ok: true, attempts: i, result: await fn() }; } catch (err) {
      lastErr = err;
      if (err && err.status >= 400 && err.status < 500 && err.status !== 429) break;
      if (i < attempts) await sleep(delayMs * i);
    }
  }
  return { ok: false, error: lastErr ? lastErr.message : 'failed' };
}

function hasTwilio(env = process.env) {
  return usable(env.TWILIO_ACCOUNT_SID) && usable(env.TWILIO_AUTH_TOKEN) &&
    (usable(env.TWILIO_FROM) || usable(env.TWILIO_MESSAGING_SERVICE_SID));
}

async function sendSms({ to, body, env = process.env, fetchImpl = globalThis.fetch }) {
  const params = new URLSearchParams({ To: to, Body: body });
  if (usable(env.TWILIO_MESSAGING_SERVICE_SID)) params.set('MessagingServiceSid', env.TWILIO_MESSAGING_SERVICE_SID);
  else params.set('From', env.TWILIO_FROM);
  const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');
  const res = await fetchImpl(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  let json = {};
  try { json = await res.json(); } catch (_e) { json = {}; }
  if (!res.ok) { const e = new Error(json.message || `Twilio SMS failed (${res.status})`); e.status = res.status; throw e; }
  return { sid: json.sid || null };
}

// Sent log: same SQLite pattern as call_store, separate table so the workbench call list is untouched.
function logDb() {
  const p = path.resolve(process.env.CALL_STORE_PATH || path.join(__dirname, '..', 'data', 'calls.sqlite'));
  if (db && dbPath === p) return db;
  if (db) db.close();
  const Database = require('better-sqlite3');
  fs.mkdirSync(path.dirname(p), { recursive: true });
  db = new Database(p);
  dbPath = p;
  db.pragma('journal_mode = WAL');
  db.exec(`CREATE TABLE IF NOT EXISTS righto_log (
    call_id TEXT PRIMARY KEY, customer_id TEXT, updated_at TEXT NOT NULL, payload TEXT NOT NULL)`);
  return db;
}

function getLog(callId) {
  const row = logDb().prepare('SELECT payload FROM righto_log WHERE call_id = ?').get(callId);
  return row ? JSON.parse(row.payload) : null;
}

function saveLog(callId, customerId, entry) {
  const updatedAt = new Date().toISOString();
  const next = { ...(getLog(callId) || {}), ...entry, callId, customerId, updatedAt };
  logDb().prepare(`INSERT INTO righto_log (call_id, customer_id, updated_at, payload) VALUES (?, ?, ?, ?)
    ON CONFLICT(call_id) DO UPDATE SET updated_at = excluded.updated_at, payload = excluded.payload`)
    .run(callId, customerId, updatedAt, JSON.stringify(next));
  return next;
}

function closeLog() { if (db) { db.close(); db = null; dbPath = null; } }

const sqliteStore = { get: id => getLog(id), save: (id, cid, e) => saveLog(id, cid, e) };

async function handleEvent(payload, { env = process.env, customers, fetchImpl, sleep, log = console, store = sqliteStore } = {}) {
  const call = payload.call || {};
  const customer = findCustomer(call, customers);
  if (!customer) return { handled: false };
  if (payload.event !== 'call_analyzed') return { handled: true, skipped: payload.event };

  const callId = call.call_id;
  const prior = callId ? store.get(callId) : null;
  if (prior && prior.status === 'sent') return { handled: true, duplicate: true };

  const details = extractDetails(call);
  const to = recipients(customer, env);
  const dryRun = String(env.RIGHTO_DRY_RUN || '').toLowerCase() === 'true' || call.metadata?.righto_dry_run === true;
  const result = { details, dryRun, sms: null, email: null };

  if (dryRun) {
    result.sms = { skipped: 'dry run' };
    result.email = { skipped: 'dry run' };
  } else {
    if (!hasTwilio(env)) { log.log('righto: sms skipped: no credentials'); result.sms = { skipped: 'no credentials' }; }
    else if (!to.sms) { log.log('righto: sms skipped: no recipient'); result.sms = { skipped: 'no recipient' }; }
    else result.sms = await withRetry(() => sendSms({ to: to.sms, body: buildSms(customer, details), env, fetchImpl }), { sleep });

    if (!usable(env.RESEND_API_KEY)) result.email = { skipped: 'no credentials' };
    else {
      const message = buildEmail(customer, details, call);
      result.email = await withRetry(() => delivery.sendViaResend({ to: to.email, message, env, fetchImpl }), { sleep });
    }
  }

  const anyFail = [result.sms, result.email].some(r => r && r.ok === false);
  const status = dryRun ? 'dry_run' : anyFail ? 'partial_error' : 'sent';
  store.save(callId, customer.id, { status, ...result, analyzedAt: new Date().toISOString() });
  return { handled: true, status, ...result };
}

module.exports = {
  ELLE_AGENT_ID, loadCustomers, findCustomer, extractDetails, buildSms, buildEmail,
  withRetry, hasTwilio, sendSms, handleEvent, getLog, closeLog, recipients,
};
