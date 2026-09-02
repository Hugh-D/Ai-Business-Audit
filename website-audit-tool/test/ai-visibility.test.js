const assert = require('node:assert/strict');
const { evaluateAiVisibilitySignals, buildQueries, checkAiVisibility } = require('../../packages/website-audit-core/ai-visibility');
const { analyzeHtml } = require('../../packages/website-audit-core');

async function run() {
    const positiveResults = {
        categoryResults: [
            { queryId: 'general', query: 'test', mentioned: true, position: 1, competitorCount: 3, competitors: ['A', 'B', 'C'] },
            { queryId: 'urgent', query: 'test', mentioned: true, position: 2, competitorCount: 4, competitors: ['A', 'B', 'C', 'D'] },
            { queryId: 'recommendation', query: 'test', mentioned: true, position: 1, competitorCount: 2, competitors: ['A', 'B'] },
            { queryId: 'reviews', query: 'test', mentioned: true, position: 3, competitorCount: 5, competitors: ['A', 'B', 'C', 'D', 'E'] },
        ],
        directResult: {
            recognised: true,
            nameAccurate: true,
            locationAccurate: true,
            servicesAccurate: true,
            sentiment: 'positive',
            description: 'A great business.',
        },
    };

    const positiveSignals = evaluateAiVisibilitySignals(positiveResults);
    assert.equal(positiveSignals.length, 8);
    assert.ok(positiveSignals.every(s => s.status === 'found'), 'All signals should be found for positive results');

    const negativeResults = {
        categoryResults: [
            { queryId: 'general', query: 'test', mentioned: false, position: 0, competitorCount: 5, competitors: ['A', 'B', 'C', 'D', 'E'] },
            { queryId: 'urgent', query: 'test', mentioned: false, position: 0, competitorCount: 3, competitors: ['A', 'B', 'C'] },
        ],
        directResult: {
            recognised: false,
            nameAccurate: false,
            locationAccurate: false,
            servicesAccurate: false,
            sentiment: 'neutral',
            description: '',
        },
    };

    const negativeSignals = evaluateAiVisibilitySignals(negativeResults);
    assert.equal(negativeSignals.length, 8);
    assert.ok(negativeSignals.every(s => s.status === 'missing'), 'All signals should be missing for negative results');

    assert.deepEqual(evaluateAiVisibilitySignals(null), []);
    assert.deepEqual(evaluateAiVisibilitySignals(undefined), []);

    const signal = positiveSignals[0];
    assert.ok(signal.id);
    assert.ok(signal.category);
    assert.ok(signal.categoryLabel);
    assert.ok(signal.label);
    assert.ok(['found', 'missing'].includes(signal.status));
    assert.ok(signal.detail);

    const basicQueries = buildQueries({ industry: 'electrician', location: 'Sydney' });
    assert.equal(basicQueries.length, 4);
    assert.ok(basicQueries[0].query.includes('electrician'));
    assert.ok(basicQueries[0].query.includes('Sydney'));

    const serviceQueries = buildQueries({ industry: 'electrician', location: 'Sydney', services: ['switchboard upgrades', 'emergency repairs'] });
    assert.equal(serviceQueries.length, 6);
    assert.ok(serviceQueries.some(q => q.query.includes('switchboard upgrades')));

    const customQueries = buildQueries({ industry: 'electrician', location: 'Sydney', customQueries: ['custom query 1', 'custom query 2'] });
    assert.equal(customQueries.length, 6);
    assert.ok(customQueries.some(q => q.query === 'custom query 1'));

    const fullQueries = buildQueries({ industry: 'electrician', location: 'Sydney', services: ['repairs'], customQueries: ['my query'] });
    assert.equal(fullQueries.length, 6);

    const mockFetch = (_url, opts) => {
        const body = JSON.parse(opts.body);
        const userMessage = body.messages.find(m => m.role === 'user')?.content || '';

        if (userMessage.includes('What can you tell me about')) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    choices: [{ message: { content: JSON.stringify({
                        recognised: true,
                        name: 'Test Electrical',
                        location: 'Sydney',
                        services: ['electrical repairs', 'installations'],
                        sentiment: 'positive',
                        description: 'A reliable electrical company.',
                    }) } }],
                }),
            });
        }

        return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                choices: [{ message: { content: JSON.stringify({
                    businesses: [
                        { name: 'Test Electrical', description: 'Great electrician' },
                        { name: 'Other Sparks', description: 'Another electrician' },
                    ],
                }) } }],
            }),
        });
    };

    const aiResults = await checkAiVisibility({
        businessName: 'Test Electrical',
        location: 'Sydney',
        industry: 'electrician',
        apiKey: 'test-key',
        fetchImpl: mockFetch,
    });

    assert.ok(aiResults.categoryResults.length > 0);
    assert.ok(aiResults.categoryResults.every(r => r.mentioned));
    assert.equal(aiResults.categoryResults[0].position, 1);
    assert.equal(aiResults.directResult.recognised, true);
    assert.equal(aiResults.directResult.nameAccurate, true);
    assert.equal(aiResults.directResult.sentiment, 'positive');
    assert.equal(aiResults.provider, 'openai');
    assert.ok(aiResults.queriedAt);

    try {
        await checkAiVisibility({ businessName: 'Test', location: 'Sydney', industry: 'electrician' });
        assert.fail('Should have thrown without apiKey');
    } catch (err) {
        assert.ok(err.message.includes('OPENAI_API_KEY'));
    }

    try {
        await checkAiVisibility({ apiKey: 'key', location: 'Sydney', industry: 'electrician' });
        assert.fail('Should have thrown without businessName');
    } catch (err) {
        assert.ok(err.message.includes('businessName'));
    }

    const mockFailFetch = () => Promise.resolve({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
    });

    const failResults = await checkAiVisibility({
        businessName: 'Test',
        location: 'Sydney',
        industry: 'electrician',
        apiKey: 'bad-key',
        fetchImpl: mockFailFetch,
    });
    assert.ok(failResults.categoryResults.every(r => !r.mentioned));
    assert.ok(failResults.categoryResults.every(r => r.error));
    assert.equal(failResults.directResult.recognised, false);
    assert.ok(failResults.directResult.error);

    const htmlWithSignals = '<title>Test Page Title Here Now</title><meta name="viewport" content="width=device-width">';
    const withAi = analyzeHtml({
        html: htmlWithSignals,
        websiteUrl: 'https://example.com',
        aiVisibilityResults: positiveResults,
    });
    assert.ok(withAi.signals.some(s => s.id === 'aiCategoryMentioned'));
    assert.ok(withAi.categoryScores.some(cs => cs.category === 'aiDiscovery'));

    const withoutAi = analyzeHtml({
        html: htmlWithSignals,
        websiteUrl: 'https://example.com',
    });
    assert.ok(!withoutAi.signals.some(s => s.id === 'aiCategoryMentioned'));
    assert.ok(!withoutAi.categoryScores.some(cs => cs.category === 'aiDiscovery'));

    const perfectHtml = [
        '<title>Demo Plumbing Sydney Emergency Plumbers</title>',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<meta name="description" content="Emergency plumbing help, fast quote requests, and reliable repairs across Sydney suburbs.">',
        '<script type="application/ld+json">{"@type":"LocalBusiness","name":"Demo Plumbing","telephone":"+61255550000","address":{"@type":"PostalAddress"},"sameAs":["https://facebook.com/demo"]}</script>',
        '<script type="application/ld+json">{"@type":"FAQPage","mainEntity":[]}</script>',
        '<h1>Emergency plumbing help in Sydney</h1>',
        '<a href="tel:+61255550000">Call now</a>',
        '<a href="/quote">Request a quote</a>',
        '<form></form>',
        '<p>Licensed, insured, 24/7 emergency plumber with strong Google reviews.</p>',
    ].join('\n');
    const existingResult = analyzeHtml({ html: perfectHtml, websiteUrl: 'https://demoplumbing.com.au' });
    assert.equal(existingResult.overallScore, 10, 'Existing perfect score must not change when AI visibility is not opted in');

    const mixedResults = {
        categoryResults: [
            { queryId: 'general', query: 'test', mentioned: true, position: 5, competitorCount: 6, competitors: ['A', 'B', 'C', 'D', 'E', 'F'] },
            { queryId: 'urgent', query: 'test', mentioned: false, position: 0, competitorCount: 3, competitors: ['A', 'B', 'C'] },
            { queryId: 'recommendation', query: 'test', mentioned: false, position: 0, competitorCount: 4, competitors: ['A', 'B', 'C', 'D'] },
            { queryId: 'reviews', query: 'test', mentioned: false, position: 0, competitorCount: 2, competitors: ['A', 'B'] },
        ],
        directResult: {
            recognised: true,
            nameAccurate: true,
            locationAccurate: true,
            servicesAccurate: false,
            sentiment: 'neutral',
            description: 'An electrical company.',
        },
    };
    const mixedSignals = evaluateAiVisibilitySignals(mixedResults);
    const foundIds = mixedSignals.filter(s => s.status === 'found').map(s => s.id);
    const missingIds = mixedSignals.filter(s => s.status === 'missing').map(s => s.id);
    assert.ok(foundIds.includes('aiCategoryMentioned'));
    assert.ok(foundIds.includes('aiDirectRecognised'));
    assert.ok(foundIds.includes('aiNameAccurate'));
    assert.ok(foundIds.includes('aiLocationAccurate'));
    assert.ok(missingIds.includes('aiMentionBreadth'));
    assert.ok(missingIds.includes('aiCompetitorPosition'));
    assert.ok(missingIds.includes('aiServicesAccurate'));
    assert.ok(missingIds.includes('aiSentimentPositive'));

    console.log('ai-visibility tests passed');
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
