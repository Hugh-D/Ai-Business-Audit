// Normalizes raw voice transcripts before they are passed to the report engine.

const FILLER_WORDS = /\b(um|uh|like|you know|i mean|basically|literally|right\?|okay\?)\b/gi;
const REPEATED_SPACES = /\s{2,}/g;
const REPEATED_PUNCTUATION = /([.!?]){2,}/g;

function clean(rawTranscript) {
  if (typeof rawTranscript !== 'string') {
    throw new TypeError('transcript must be a string');
  }

  return rawTranscript
    .replace(FILLER_WORDS, '')
    .replace(REPEATED_PUNCTUATION, '$1')
    .replace(REPEATED_SPACES, ' ')
    .trim();
}

// Splits a cleaned transcript into labeled speaker turns.
// Expects lines prefixed with "Agent:" or "Client:" (case-insensitive).
function parseTurns(cleanedTranscript) {
  const lines = cleanedTranscript.split('\n').filter(Boolean);
  return lines.map(line => {
    const match = line.match(/^(agent|client|interviewer|prospect):\s*/i);
    if (match) {
      return { speaker: match[1].toLowerCase(), text: line.slice(match[0].length).trim() };
    }
    return { speaker: 'unknown', text: line.trim() };
  });
}

module.exports = { clean, parseTurns };
