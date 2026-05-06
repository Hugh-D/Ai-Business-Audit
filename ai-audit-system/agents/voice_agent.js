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

  const expected = crypto
    .createHmac('sha256', apiKey)
    .update(rawBody)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    const err = new Error('Invalid Retell webhook signature');
    err.status = 401;
    throw err;
  }

  return JSON.parse(rawBody.toString('utf8'));
}

function buildVoicePrompt(config) {
  const hints = config.voicePromptHints.map(h => `- ${h}`).join('\n');
  return VOICE_SYSTEM_PROMPT
    .replace('{{INDUSTRY_LABEL}}', config.label)
    .replace('{{INDUSTRY_DESCRIPTION}}', config.description)
    .replace('{{VOICE_PROMPT_HINTS}}', hints);
}

module.exports = { createSession, parseRetellWebhook };
