const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const VOICE_SYSTEM_PROMPT = fs.readFileSync(
  path.join(__dirname, '../prompts/voice_system.txt'),
  'utf8'
);

// Builds a voice session configuration scoped to the given industry config.
// Returns the system prompt and session-level settings to forward to Retell.
async function createSession(config) {
  const systemPrompt = buildVoicePrompt(config);

  return {
    systemPrompt,
    model: process.env.VOICE_MODEL || 'claude-sonnet-4-20250514',
    industry: config.id,
    hints: config.voicePromptHints,
  };
}

async function createPhoneAuditCall({ config, businessName, contactName, phoneNumber }) {
  const apiKey = process.env.RETELL_API_KEY;
  const fromNumber = process.env.RETELL_FROM_NUMBER;
  const agentId = process.env.RETELL_AGENT_ID;
  if (!hasUsableEnvValue(apiKey)) throw new Error('RETELL_API_KEY environment variable is not set');
  if (!hasUsableEnvValue(fromNumber)) throw new Error('RETELL_FROM_NUMBER environment variable is not set');
  if (!hasUsableEnvValue(agentId)) throw new Error('RETELL_AGENT_ID environment variable is not set');

  const body = {
    from_number: fromNumber,
    to_number: phoneNumber,
    metadata: {
      industry: config.id,
      businessName,
      contactName,
      source: 'ai-business-audit-mvp',
    },
    retell_llm_dynamic_variables: {
      industry: config.label,
      business_name: businessName || 'the business',
      contact_name: contactName || 'there',
      audit_focus: config.auditFocus.join('; '),
    },
  };

  body.override_agent_id = agentId;

  const response = await fetch('https://api.retellai.com/v2/create-phone-call', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.message || payload.error || `Retell call creation failed with status ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }

  return payload;
}

function hasUsableEnvValue(value) {
  return Boolean(value && !String(value).startsWith('your_') && !String(value).endsWith('_here'));
}

// Verifies the Retell webhook signature and returns the parsed payload.
// rawBody must be the raw request body Buffer (captured before JSON parsing).
// Throws a 401 error if the signature is missing or invalid.
//
// Retell sends the transcript in payload.call.transcript (plain string) and
// the industry in payload.call.metadata.industry (set when creating the call).
// Only call_ended events carry a completed transcript.
function parseRetellWebhook(rawBody, signature) {
  if (!signature) {
    const err = new Error('Missing x-retell-signature header');
    err.status = 401;
    throw err;
  }

  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) throw new Error('RETELL_API_KEY environment variable is not set');

  const match = String(signature).match(/^v=(\d+),d=([a-f0-9]+)$/i);
  if (!match) {
    const err = new Error('Invalid x-retell-signature format');
    err.status = 401;
    throw err;
  }

  const [, timestamp, digest] = match;
  const timestampMs = Number(timestamp);
  const fiveMinutesMs = 5 * 60 * 1000;
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > fiveMinutesMs) {
    const err = new Error('Expired Retell webhook signature');
    err.status = 401;
    throw err;
  }

  const rawBodyString = rawBody.toString('utf8');
  const expected = crypto
    .createHmac('sha256', apiKey)
    .update(rawBodyString + timestamp)
    .digest('hex');

  const signatureBuffer = Buffer.from(digest, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    const err = new Error('Invalid Retell webhook signature');
    err.status = 401;
    throw err;
  }

  return JSON.parse(rawBodyString);
}

function buildVoicePrompt(config) {
  const hints = config.voicePromptHints.map(h => `- ${h}`).join('\n');
  return VOICE_SYSTEM_PROMPT
    .replace('{{INDUSTRY_LABEL}}', config.label)
    .replace('{{INDUSTRY_DESCRIPTION}}', config.description)
    .replace('{{VOICE_PROMPT_HINTS}}', hints);
}

module.exports = { createSession, createPhoneAuditCall, parseRetellWebhook, hasUsableEnvValue };
