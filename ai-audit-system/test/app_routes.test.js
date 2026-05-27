const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const events = require('node:events');
const os = require('node:os');
const path = require('node:path');
const ExcelJS = require('exceljs');

process.env.CALL_STORE_PATH = path.join(os.tmpdir(), `ai-audit-app-routes-${process.pid}.sqlite`);
events.setMaxListeners(50);

const reportEngine = require('../agents/report_engine');
const voiceAgent = require('../agents/voice_agent');
const callStore = require('../agents/call_store');
const deliveryAgent = require('../agents/delivery_agent');
const { app } = require('../index');

const originalGenerate = reportEngine.generate;
const originalCreatePhoneAuditCall = voiceAgent.createPhoneAuditCall;
const originalSendReportEmail = deliveryAgent.sendReportEmail;
const originalEnv = {
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  AUDIT_PHONE_NUMBER: process.env.AUDIT_PHONE_NUMBER,
  RETELL_API_KEY: process.env.RETELL_API_KEY,
  RETELL_FROM_NUMBER: process.env.RETELL_FROM_NUMBER,
  RETELL_AGENT_ID: process.env.RETELL_AGENT_ID,
  RETELL_WEBHOOK_URL: process.env.RETELL_WEBHOOK_URL,
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_FROM: process.env.SMTP_FROM,
};

test.beforeEach(() => {
  callStore.clear();
  reportEngine.generate = originalGenerate;
  voiceAgent.createPhoneAuditCall = originalCreatePhoneAuditCall;
  deliveryAgent.sendReportEmail = originalSendReportEmail;
  restoreEnv();
});

test.afterEach(() => {
  callStore.clear();
  reportEngine.generate = originalGenerate;
  voiceAgent.createPhoneAuditCall = originalCreatePhoneAuditCall;
  deliveryAgent.sendReportEmail = originalSendReportEmail;
  restoreEnv();
});

test('POST /audit returns a generated report for a cleaned transcript', async () => {
  let captured = null;
  reportEngine.generate = async (input) => {
    captured = input;
    return {
      overallScore: 8,
      keyStrengths: ['Fast first response'],
      criticalGaps: [],
      sections: {},
      actionPlan: [],
    };
  };

  const response = await requestJson('POST', '/audit', {
    industry: 'trades',
    transcript: 'Client: Um, we call them back!!',
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.industry, 'trades');
  assert.equal(response.body.report.overallScore, 8);
  assert.match(response.body.auditId, /^[0-9a-f-]{36}$/);
  assert.equal(captured.config.id, 'trades');
  assert.equal(captured.transcript, 'Client: we call them back!');
});

test('POST /audit validates required fields', async () => {
  const response = await requestJson('POST', '/audit', { industry: 'trades' });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'industry and transcript are required');
});

test('POST /export/xlsx returns an editable workbook', async () => {
  const response = await requestJson('POST', '/export/xlsx', {
    auditId: 'audit_export',
    industry: 'trades',
    businessName: 'Demo Plumbing Co',
    transcript: 'Client: We miss calls.',
    report: {
      overallScore: 8,
      scores: { leadResponse: 7 },
      keyStrengths: ['Strong repeat customers'],
      criticalGaps: ['Missed after-hours calls'],
      sections: { leadFlow: 'Leads arrive by phone.' },
      actionPlan: [{ priority: 'High', action: 'Automate missed-call follow-up.', timeframe: '14 days' }],
    },
  });

  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get('content-type'),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  assert.match(response.headers.get('content-disposition'), /trades-audit-export\.xlsx/);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(response.buffer);

  assert.deepEqual(workbook.worksheets.map(sheet => sheet.name), [
    'Summary',
    'Scores',
    'Findings',
    'Action Plan',
    'Transcript',
  ]);
  assert.equal(workbook.getWorksheet('Summary').getCell('B2').value, 'Demo Plumbing Co');
  assert.equal(workbook.getWorksheet('Scores').getCell('A2').value, 'Lead Response');
  assert.equal(workbook.getWorksheet('Action Plan').getCell('B2').value, 'Automate missed-call follow-up.');
});

test('POST /export/xlsx validates required fields', async () => {
  const response = await requestJson('POST', '/export/xlsx', {
    industry: 'trades',
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'industry and report are required');
});

test('GET /readiness summarizes missing inbound launch configuration', async () => {
  delete process.env.ANTHROPIC_API_KEY;
  process.env.RETELL_API_KEY = 'test_retell_key';
  process.env.RETELL_AGENT_ID = 'agent_test';
  delete process.env.RETELL_FROM_NUMBER;
  delete process.env.AUDIT_PHONE_NUMBER;
  delete process.env.RETELL_WEBHOOK_URL;
  delete process.env.PUBLIC_BASE_URL;
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_FROM;

  const response = await requestJson('GET', '/readiness');

  assert.equal(response.status, 200);
  assert.equal(response.body.readyForManualAudit, false);
  assert.equal(response.body.readyForInboundAudits, false);
  assert.equal(response.body.readyForEmailDelivery, false);
  assert.equal(findReadinessCheck(response.body, 'audit_phone_number').status, 'missing');
  assert.equal(findReadinessCheck(response.body, 'retell_from_number').status, 'optional');
  assert.equal(findReadinessCheck(response.body, 'smtp_delivery').status, 'optional');
  assert.ok(response.body.nextSteps.some(step => step.includes('AUDIT_PHONE_NUMBER')));
});

test('GET /readiness marks inbound audit testing ready without outbound number', async () => {
  process.env.ANTHROPIC_API_KEY = 'test_anthropic_key';
  process.env.RETELL_API_KEY = 'test_retell_key';
  process.env.AUDIT_PHONE_NUMBER = '1300 244 357';
  process.env.RETELL_WEBHOOK_URL = 'https://audit.example.com/webhook/retell';
  delete process.env.RETELL_AGENT_ID;
  delete process.env.RETELL_FROM_NUMBER;
  process.env.SMTP_HOST = 'smtp.example.com';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_FROM = 'audit@example.com';

  const response = await requestJson('GET', '/readiness');

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ready');
  assert.equal(response.body.readyForManualAudit, true);
  assert.equal(response.body.readyForInboundAudits, true);
  assert.equal(response.body.readyForEmailDelivery, true);
  assert.equal(findReadinessCheck(response.body, 'retell_from_number').status, 'optional');
  assert.deepEqual(response.body.nextSteps, [
    'Call 1300 244 357 and confirm Retell posts the completed assessment to /webhook/retell.',
  ]);
});

test('POST /voice/call stores a created Retell call', async () => {
  voiceAgent.createPhoneAuditCall = async ({ config, businessName, contactName, phoneNumber }) => ({
    call_id: 'call_created',
    call_status: 'registered',
    direction: 'outbound',
    metadata: {
      industry: config.id,
      businessName,
      contactName,
    },
    to_number: phoneNumber,
  });

  const response = await requestJson('POST', '/voice/call', {
    industry: 'realtors',
    businessName: 'Harbour Realty',
    contactName: 'Clare',
    phoneNumber: '+61474779711',
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.call.callId, 'call_created');
  assert.equal(response.body.call.industry, 'realtors');
  assert.equal(response.body.call.businessName, 'Harbour Realty');
  assert.equal(callStore.get('call_created').phoneNumber, '+61474779711');
});

test('POST /voice/call surfaces missing Retell number setup', async () => {
  process.env.RETELL_API_KEY = 'test_retell_key';
  delete process.env.RETELL_FROM_NUMBER;
  process.env.RETELL_AGENT_ID = 'agent_test';

  const response = await withoutConsoleError(() => requestJson('POST', '/voice/call', {
    industry: 'trades',
    phoneNumber: '+61474779711',
  }));

  assert.equal(response.status, 500);
  assert.equal(response.body.error, 'RETELL_FROM_NUMBER environment variable is not set');
});

test('GET /voice/calls and /voice/calls/:callId return stored calls', async () => {
  callStore.save('call_one', { status: 'registered', industry: 'trades' });

  const listResponse = await requestJson('GET', '/voice/calls');
  const itemResponse = await requestJson('GET', '/voice/calls/call_one');

  assert.equal(listResponse.status, 200);
  assert.equal(listResponse.body.calls.length, 1);
  assert.equal(listResponse.body.calls[0].callId, 'call_one');
  assert.equal(itemResponse.status, 200);
  assert.equal(itemResponse.body.call.industry, 'trades');
});

test('GET /voice/calls/:callId returns 404 for unknown calls', async () => {
  const response = await requestJson('GET', '/voice/calls/missing_call');

  assert.equal(response.status, 404);
  assert.equal(response.body.error, 'Call not found');
});

test('PATCH /voice/calls/:callId/review updates review workflow state', async () => {
  callStore.save('call_review', {
    status: 'report_ready',
    industry: 'trades',
    report: { overallScore: 8 },
  });

  const response = await requestJson('PATCH', '/voice/calls/call_review/review', {
    reviewStatus: 'reviewed',
    reviewNotes: 'Tighten recommendation wording before sending.',
    recipientEmail: 'owner@example.com',
    deliveryNotes: 'Attach the editable workbook.',
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.call.reviewStatus, 'reviewed');
  assert.equal(response.body.call.reviewNotes, 'Tighten recommendation wording before sending.');
  assert.equal(response.body.call.recipientEmail, 'owner@example.com');
  assert.equal(response.body.call.deliveryNotes, 'Attach the editable workbook.');
  assert.ok(response.body.call.reviewedAt);
  assert.equal(callStore.get('call_review').reviewStatus, 'reviewed');
});

test('PATCH /voice/calls/:callId/review marks sent reports', async () => {
  callStore.save('call_sent', {
    status: 'report_ready',
    industry: 'trades',
    report: { overallScore: 8 },
  });

  const response = await requestJson('PATCH', '/voice/calls/call_sent/review', {
    reviewStatus: 'sent',
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.call.reviewStatus, 'sent');
  assert.ok(response.body.call.reviewedAt);
  assert.ok(response.body.call.sentAt);
});

test('PATCH /voice/calls/:callId/review validates review status', async () => {
  callStore.save('call_invalid_review', {
    status: 'report_ready',
    industry: 'trades',
    report: { overallScore: 8 },
  });

  const response = await requestJson('PATCH', '/voice/calls/call_invalid_review/review', {
    reviewStatus: 'approved',
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'reviewStatus must be draft, reviewed, or sent');
});

test('PATCH /voice/calls/:callId/review validates recipient email', async () => {
  callStore.save('call_invalid_email', {
    status: 'report_ready',
    industry: 'trades',
    report: { overallScore: 8 },
  });

  const response = await requestJson('PATCH', '/voice/calls/call_invalid_email/review', {
    reviewStatus: 'reviewed',
    recipientEmail: 'not-an-email',
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'recipientEmail must be a valid email address');
});

test('PATCH /voice/calls/:callId/review requires a report', async () => {
  callStore.save('call_no_report', {
    status: 'registered',
    industry: 'trades',
  });

  const response = await requestJson('PATCH', '/voice/calls/call_no_report/review', {
    reviewStatus: 'reviewed',
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'Call does not have a report to review');
});

test('POST /voice/calls/:callId/deliver sends the workbook and marks report sent', async () => {
  let captured = null;
  deliveryAgent.sendReportEmail = async (input) => {
    captured = input;
    return {
      messageId: 'message_test',
      accepted: [input.call.recipientEmail],
      rejected: [],
    };
  };
  callStore.save('call_deliver', {
    status: 'report_ready',
    reviewStatus: 'reviewed',
    industry: 'trades',
    businessName: 'Demo Plumbing Co',
    recipientEmail: 'owner@example.com',
    report: {
      overallScore: 8,
      actionPlan: [{ action: 'Follow up faster.' }],
    },
  });

  const response = await requestJson('POST', '/voice/calls/call_deliver/deliver');

  assert.equal(response.status, 200);
  assert.equal(response.body.call.reviewStatus, 'sent');
  assert.equal(response.body.call.lastDelivery.messageId, 'message_test');
  assert.equal(captured.call.callId, 'call_deliver');
  assert.match(captured.filename, /trades-call-deliver\.xlsx/);
  assert.ok(Buffer.isBuffer(Buffer.from(captured.workbookBuffer)));
});

test('POST /voice/calls/:callId/deliver requires a recipient email', async () => {
  callStore.save('call_no_recipient', {
    status: 'report_ready',
    industry: 'trades',
    report: { overallScore: 8 },
  });

  const response = await requestJson('POST', '/voice/calls/call_no_recipient/deliver');

  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'recipientEmail is required before sending');
});

test('POST /webhook/retell accepts a signed call_ended webhook and stores the report', async () => {
  process.env.RETELL_API_KEY = 'test_retell_key';
  reportEngine.generate = async ({ config, transcript }) => ({
    overallScore: 9,
    scores: { leadResponse: 9 },
    keyStrengths: [`${config.id}:${transcript}`],
    criticalGaps: [],
    sections: {},
    actionPlan: [],
  });

  const payload = {
    event: 'call_ended',
    call: {
      call_id: 'call_webhook',
      direction: 'outbound',
      to_number: '+61474779711',
      metadata: {
        industry: 'lawn_care',
        businessName: 'Green Stripe',
        contactName: 'Mia',
      },
      transcript: 'Client: Um, lawn quote requests sit on a whiteboard!!',
    },
  };
  const { rawBody, signature } = signedWebhook(payload, process.env.RETELL_API_KEY);

  const response = await requestRaw('POST', '/webhook/retell', rawBody, {
    'content-type': 'application/json',
    'x-retell-signature': signature,
  });

  assert.equal(response.status, 204);
  await waitFor(() => callStore.get('call_webhook')?.status === 'report_ready');

  const call = callStore.get('call_webhook');
  assert.equal(call.industry, 'lawn_care');
  assert.equal(call.reviewStatus, 'draft');
  assert.equal(call.report.overallScore, 9);
  assert.equal(call.transcript, 'Client: lawn quote requests sit on a whiteboard!');
});

test('POST /webhook/retell rejects unsigned webhooks', async () => {
  process.env.RETELL_API_KEY = 'test_retell_key';

  const response = await withoutConsoleError(() => requestRaw('POST', '/webhook/retell', Buffer.from('{"event":"call_started"}'), {
    'content-type': 'application/json',
  }));

  assert.equal(response.status, 401);
  assert.equal(response.body.error, 'Missing x-retell-signature header');
});

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

async function requestJson(method, path, body) {
  return requestRaw(
    method,
    path,
    body === undefined ? undefined : Buffer.from(JSON.stringify(body)),
    body === undefined ? {} : { 'content-type': 'application/json' }
  );
}

async function requestRaw(method, path, body, headers = {}) {
  const server = app.listen(0);
  await onceListening(server);

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers,
      body: method === 'GET' ? undefined : body,
    });
    const contentType = response.headers.get('content-type') || '';
    const buffer = Buffer.from(await response.arrayBuffer());
    const text = buffer.toString('utf8');
    const parsed = text && contentType.includes('application/json') ? JSON.parse(text) : null;

    return {
      status: response.status,
      headers: response.headers,
      buffer,
      body: parsed,
    };
  } finally {
    await closeServer(server);
  }
}

function onceListening(server) {
  if (server.listening) return Promise.resolve();
  return new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function signedWebhook(payload, apiKey, timestamp = Date.now()) {
  const rawBody = Buffer.from(JSON.stringify(payload));
  const digest = crypto
    .createHmac('sha256', apiKey)
    .update(rawBody.toString('utf8') + timestamp)
    .digest('hex');

  return {
    rawBody,
    signature: `v=${timestamp},d=${digest}`,
  };
}

async function waitFor(predicate, timeoutMs = 1000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  assert.fail('Timed out waiting for condition');
}

async function withoutConsoleError(fn) {
  const original = console.error;
  console.error = () => {};

  try {
    return await fn();
  } finally {
    console.error = original;
  }
}

function findReadinessCheck(payload, id) {
  const check = payload.checks.find(item => item.id === id);
  assert.ok(check, `Missing readiness check ${id}`);
  return check;
}
