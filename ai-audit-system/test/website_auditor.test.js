const test = require('node:test');
const assert = require('node:assert/strict');

const websiteAuditor = require('../agents/website_auditor');

test('normalizeWebsiteUrl accepts bare domains and removes fragments', () => {
  assert.equal(
    websiteAuditor.normalizeWebsiteUrl('greenstripe.com.au/#contact'),
    'https://greenstripe.com.au'
  );
  assert.equal(websiteAuditor.normalizeWebsiteUrl('not a url'), '');
});

test('analyzeHtml detects customer journey signals and logo candidates', () => {
  const review = websiteAuditor.analyzeHtml({
    websiteUrl: 'https://example.com.au',
    html: `
      <!doctype html>
      <html>
        <head>
          <title>Example Plumbing</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <meta name="description" content="Fast plumbing help.">
          <link rel="icon" href="/favicon.png">
        </head>
        <body>
          <a href="tel:+61255550000">Call now</a>
          <a href="/quote">Request a quote</a>
          <form action="/contact"></form>
          <p>Google reviews and 24/7 emergency plumbing.</p>
        </body>
      </html>
    `,
  });

  assert.equal(review.title, 'Example Plumbing');
  assert.equal(review.description, 'Fast plumbing help.');
  assert.equal(review.logoUrl, 'https://example.com.au/favicon.png');
  assert.equal(review.overallScore, 6);
  assert.deepEqual(
    review.signals.slice(0, 6).map(signal => [signal.id, signal.status]),
    [
      ['phoneVisibility', 'found'],
      ['primaryCta', 'found'],
      ['contactPath', 'found'],
      ['trustSignals', 'found'],
      ['mobileReadiness', 'found'],
      ['afterHoursCapture', 'found'],
    ]
  );
  assert.equal(review.signals.find(signal => signal.id === 'schemaMarkup').status, 'missing');
});

test('reviewWebsite fetches and analyzes a normalized website URL', async () => {
  const review = await websiteAuditor.reviewWebsite('example.com.au', {
    fetchImpl: async (url) => ({
      status: 200,
      url,
      text: async () => '<title>Example</title><body>No clear CTA yet.</body>',
    }),
  });

  assert.equal(review.websiteUrl, 'https://example.com.au');
  assert.equal(review.title, 'Example');
  assert.ok(review.opportunities.length > 0);
});

test('analyzeHtml includes category scores and action plan', () => {
  const review = websiteAuditor.analyzeHtml({
    websiteUrl: 'https://example.com.au',
    html: '<title>Tiny</title><h1>Help</h1><body>No obvious conversion path.</body>',
  });

  assert.ok(review.categoryScores.some(score => score.category === 'conversion'));
  assert.ok(review.actionPlan.some(item => item.action.includes('phone number')));
});
