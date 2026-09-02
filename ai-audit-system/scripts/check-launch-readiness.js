const http = require('node:http');

const baseUrl = String(process.env.PUBLIC_BASE_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '');

async function run() {
  const health = await requestJson('/health');
  if (health.status !== 200 || health.body.status !== 'ok') {
    throw new Error(`Health check failed at ${baseUrl}/health`);
  }

  const readiness = await requestJson('/readiness');
  if (readiness.status !== 200) {
    throw new Error(`Readiness check failed at ${baseUrl}/readiness`);
  }

  console.log(`App reachable: ${baseUrl}`);
  console.log(`Manual audit: ${readiness.body.readyForManualAudit ? 'ready' : 'blocked'}`);
  console.log(`Inbound audits: ${readiness.body.readyForInboundAudits ? 'ready' : 'blocked'}`);
  console.log(`Email delivery: ${readiness.body.readyForEmailDelivery ? 'ready' : 'optional/not configured'}`);

  for (const check of readiness.body.checks || []) {
    console.log(`- ${check.label}: ${check.status}`);
  }

  if (readiness.body.nextSteps?.length) {
    console.log('Next steps:');
    for (const step of readiness.body.nextSteps) console.log(`- ${step}`);
  }

  if (!readiness.body.readyForInboundAudits) process.exitCode = 1;
}

function requestJson(pathname) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathname, `${baseUrl}/`);
    const request = http.get(url, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        body += chunk;
      });
      response.on('end', () => {
        try {
          resolve({
            status: response.statusCode,
            body: body ? JSON.parse(body) : {},
          });
        } catch (err) {
          reject(new Error(`Invalid JSON returned by ${url}: ${err.message}`));
        }
      });
    });

    request.setTimeout(10_000, () => {
      request.destroy(new Error(`Timed out requesting ${url}`));
    });
    request.on('error', reject);
  });
}

run().catch(err => {
  console.error(err.message);
  process.exitCode = 1;
});
