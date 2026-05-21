const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const reportEngine = require('../agents/report_engine');
const voiceAgent = require('../agents/voice_agent');
const callStore = require('../agents/call_store');
const { app } = require('../index');

const originalGenerate = reportEngine.generate;
const originalCreatePhoneAuditCall = voiceAgent.createPhoneAuditCall;
const originalEnv = {
  RETELL_API_KEY: process.env.RETELL_API_KEY,
  RETELL_FROM_NUMBER: process.env.RETELL_FROM_NUMBER,
  RETELL_AGENT_ID: process.env.RETELL_AGENT_ID,
};

test.beforeEach(() => {
  callStore.clear();
  reportEngine.generate = originalGenerate;
  voiceAgent.createPhoneAuditCall = originalCreatePhoneAuditCall;
  restoreEnv();
});

test.afterEach(() => {
  callStore.clear();
  reportEngine.generate = originalGenerate;
  voiceAgent.createPhoneAuditCall = originalCreatePhoneAuditCall;
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
    const text = await response.text();
    const parsed = text ? JSON.parse(text) : null;

    return {
      status: response.status,
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
