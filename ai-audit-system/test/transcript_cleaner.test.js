const test = require('node:test');
const assert = require('node:assert/strict');

const transcriptCleaner = require('../agents/transcript_cleaner');

test('clean removes common filler and normalizes punctuation and spacing', () => {
  const cleaned = transcriptCleaner.clean(' Um, we basically call them back!!   You know, if we remember... ');

  assert.equal(cleaned, 'we call them back! if we remember.');
});

test('clean rejects non-string transcripts', () => {
  assert.throws(() => transcriptCleaner.clean(null), /transcript must be a string/);
});

test('parseTurns labels known speakers and preserves unknown lines', () => {
  const turns = transcriptCleaner.parseTurns([
    'Agent: How do leads come in?',
    'Client: Mostly calls.',
    'Loose note without speaker',
  ].join('\n'));

  assert.deepEqual(turns, [
    { speaker: 'agent', text: 'How do leads come in?' },
    { speaker: 'client', text: 'Mostly calls.' },
    { speaker: 'unknown', text: 'Loose note without speaker' },
  ]);
});
