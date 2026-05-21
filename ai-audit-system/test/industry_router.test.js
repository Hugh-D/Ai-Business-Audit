const test = require('node:test');
const assert = require('node:assert/strict');

const industryRouter = require('../agents/industry_router');

test('resolve accepts exact industry IDs', () => {
  assert.equal(industryRouter.resolve('trades').id, 'trades');
  assert.equal(industryRouter.resolve('lawn_care').id, 'lawn_care');
});

test('resolve accepts common aliases', () => {
  assert.equal(industryRouter.resolve('real estate').id, 'realtors');
  assert.equal(industryRouter.resolve('HVAC').id, 'trades');
  assert.equal(industryRouter.resolve('landscaping').id, 'lawn_care');
});

test('detect returns the best matching industry from transcript keywords', () => {
  const transcript = [
    'Client: We quote lawn mowing, fertilization, and recurring yard maintenance.',
    'Agent: How do seasonal cleanups and route density work today?',
  ].join('\n');

  assert.equal(industryRouter.detect(transcript).id, 'lawn_care');
});

test('detect returns null when no configured keywords match', () => {
  assert.equal(industryRouter.detect('A generic call with no useful business context.'), null);
});
