const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const VOICE_SYSTEM_PROMPT = fs.readFileSync(
  path.join(__dirname, '../prompts/voice_system.txt'),
  'utf8'
);

// Builds a voice session configuration scoped to the given industry config.
// Returns the system prompt and any session-level settings for the caller to
// forward to the real-time voice API or telephony layer.
async function createSession(config) {
  const systemPrompt = buildVoicePrompt(config);

  return {
    systemPrompt,
    model: process.env.VOICE_MODEL || 'gpt-4o-realtime-preview',
    voice: 'alloy',
    industry: config.id,
    hints: config.voicePromptHints,
  };
}

// Transcribes an audio buffer using Whisper.
// audioBuffer must be a Buffer; filename is used only for MIME-type detection.
async function transcribe(audioBuffer, filename = 'audio.webm') {
  const { Readable } = require('stream');
  const stream = Readable.from(audioBuffer);
  stream.path = filename;

  const transcription = await client.audio.transcriptions.create({
    model: process.env.VOICE_TRANSCRIPTION_MODEL || 'whisper-1',
    file: stream,
  });

  return transcription.text;
}

function buildVoicePrompt(config) {
  const hints = config.voicePromptHints.map(h => `- ${h}`).join('\n');
  return VOICE_SYSTEM_PROMPT
    .replace('{{INDUSTRY_LABEL}}', config.label)
    .replace('{{INDUSTRY_DESCRIPTION}}', config.description)
    .replace('{{VOICE_PROMPT_HINTS}}', hints);
}

module.exports = { createSession, transcribe };
