const fs = require('fs');
const path = require('path');

const VOICE_SYSTEM_PROMPT = fs.readFileSync(
  path.join(__dirname, '../prompts/voice_system.txt'),
  'utf8'
);

// Builds a voice session configuration scoped to the given industry config.
// Returns the system prompt and session-level settings for the caller to
// forward to the telephony or real-time voice layer.
async function createSession(config) {
  const systemPrompt = buildVoicePrompt(config);

  return {
    systemPrompt,
    model: process.env.VOICE_MODEL || 'claude-sonnet-4-20250514',
    industry: config.id,
    hints: config.voicePromptHints,
  };
}

// Audio transcription is not provided by the Anthropic API.
// Wire this function to a dedicated transcription service such as
// AssemblyAI, Deepgram, or AWS Transcribe and return the transcript string.
async function transcribe(_audioBuffer, _filename = 'audio.webm') {
  throw new Error(
    'transcribe() requires a third-party audio transcription service. ' +
    'Anthropic does not provide an audio transcription API. ' +
    'Integrate AssemblyAI, Deepgram, or AWS Transcribe and implement this function.'
  );
}

function buildVoicePrompt(config) {
  const hints = config.voicePromptHints.map(h => `- ${h}`).join('\n');
  return VOICE_SYSTEM_PROMPT
    .replace('{{INDUSTRY_LABEL}}', config.label)
    .replace('{{INDUSTRY_DESCRIPTION}}', config.description)
    .replace('{{VOICE_PROMPT_HINTS}}', hints);
}

module.exports = { createSession, transcribe };
