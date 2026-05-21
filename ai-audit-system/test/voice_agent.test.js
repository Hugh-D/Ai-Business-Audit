const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const voiceAgent = require('../agents/voice_agent');

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

function withRetellKey(value, fn) {
  const originalKey = process.env.RETELL_API_KEY;
  process.env.RETELL_API_KEY = value;

  try {
    fn();
  } finally {
    if (originalKey === undefined) {
      delete process.env.RETELL_API_KEY;
    } else {
      process.env.RETELL_API_KEY = originalKey;
    }
  }
}

test('parseRetellWebhook verifies a valid signature and parses the payload', () => {
  withRetellKey('test_retell_key', () => {
    const payload = {
      event: 'call_ended',
      call: {
        call_id: 'call_test',
        metadata: { industry: 'trades' },
        transcript: 'Client: We miss after-hours calls.',
      },
    };
    const { rawBody, signature } = signedWebhook(payload, process.env.RETELL_API_KEY);

    assert.deepEqual(voiceAgent.parseRetellWebhook(rawBody, signature), payload);
  });
});

test('parseRetellWebhook rejects invalid signatures', () => {
  withRetellKey('test_retell_key', () => {
    const { rawBody } = signedWebhook({ event: 'call_started' }, process.env.RETELL_API_KEY);

    assert.throws(
      () => voiceAgent.parseRetellWebhook(rawBody, `v=${Date.now()},d=deadbeef`),
      /Invalid Retell webhook signature/
    );
  });
});

test('parseRetellWebhook rejects expired signatures', () => {
  withRetellKey('test_retell_key', () => {
    const expiredTimestamp = Date.now() - (6 * 60 * 1000);
    const { rawBody, signature } = signedWebhook({ event: 'call_started' }, process.env.RETELL_API_KEY, expiredTimestamp);

    assert.throws(
      () => voiceAgent.parseRetellWebhook(rawBody, signature),
      /Expired Retell webhook signature/
    );
  });
});

test('hasUsableEnvValue rejects placeholders', () => {
  assert.equal(voiceAgent.hasUsableEnvValue('real_value'), true);
  assert.equal(voiceAgent.hasUsableEnvValue('your_retell_key'), false);
  assert.equal(voiceAgent.hasUsableEnvValue('retell_key_here'), false);
});
