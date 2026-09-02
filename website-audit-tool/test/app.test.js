const assert = require('node:assert/strict');
const http = require('node:http');
const { server } = require('../index');

async function run() {
    await listen();

  const health = await requestJson('GET', '/health');
    assert.equal(health.status, 200);
    assert.equal(health.body.service, 'website-audit-tool');

  const audit = await requestJson('POST', '/api/analyze-html', {
        businessName: 'Demo Plumbing',
        industry: 'trades',
        websiteUrl: 'demoplumbing.com.au',
        html: `
        <title>Demo Plumbing Sydney Emergency Plumbers</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="description" content="Emergency plumbing help, fast quote requests, and reliable repairs across Sydney suburbs.">
        <script type="application/ld+json">{"@type":"LocalBusiness","name":"Demo Plumbing","telephone":"+61255550000","address":{"@type":"PostalAddress","streetAddress":"1 Example St","addressLocality":"Sydney"},"sameAs":["https://www.facebook.com/demoplumbing"]}</script>
        <script type="application/ld+json">{"@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Do you offer emergency plumbing?","acceptedAnswer":{"@type":"Answer","text":"Yes, 24/7."}}]}</script>
        <h1>Emergency plumbing help in Sydney</h1>
        <a href="tel:+61255550000">Call now</a>
        <a href="/quote">Request a quote</a>
        <form></form>
        <p>Licensed, insured, 24/7 emergency plumber with strong Google reviews.</p>
        `,
  });
    assert.equal(audit.status, 200);
    assert.equal(audit.body.review.businessName, 'Demo Plumbing');
    assert.equal(audit.body.review.websiteUrl, 'https://demoplumbing.com.au');
    assert.equal(audit.body.review.overallScore, 10);

  const invalid = await requestJson('POST', '/api/analyze-html', { websiteUrl: 'bad url', html: '' });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.error, 'websiteUrl must be a valid website address');

  await closeServer();
    console.log('website-audit-tool tests passed');
}

function listen() {
    if (server.listening) return Promise.resolve();
    return new Promise((resolve) => {
          server.listen(0, '127.0.0.1', resolve);
    });
}

function baseUrl(path) {
    const address = server.address();
    return `http://127.0.0.1:${address.port}${path}`;
}

function requestJson(method, path, body) {
    return new Promise((resolve, reject) => {
          const payload = body ? JSON.stringify(body) : '';
          const url = new URL(baseUrl(path));
          const req = http.request({
                  hostname: url.hostname,
                  port: url.port,
                  path: url.pathname,
                  method,
                  headers: payload
                    ? {
                                'Content-Type': 'application/json',
                                'Content-Length': Buffer.byteLength(payload),
                    }
                            : undefined,
          }, (res) => {
                  let responseBody = '';
                  res.on('data', chunk => {
                            responseBody += chunk;
                  });
                  res.on('end', () => {
                            resolve({
                                        status: res.statusCode,
                                        body: responseBody ? JSON.parse(responseBody) : {},
                            });
                  });
          });
          req.on('error', reject);
          if (payload) req.write(payload);
          req.end();
    });
}

function closeServer() {
    if (!server.listening) return Promise.resolve();
    server.closeAllConnections?.();
    return new Promise((resolve, reject) => {
          server.close((err) => err ? reject(err) : resolve());
    });
}

run().catch(async (err) => {
    await closeServer();
    console.error(err);
    process.exit(1);
});
