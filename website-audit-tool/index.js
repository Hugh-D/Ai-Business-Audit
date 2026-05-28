const http = require('http');
const fs = require('fs');
const path = require('path');
const websiteAuditor = require('../packages/website-audit-core');

const PORT = Number(process.env.PORT || 3100);
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      return sendJson(res, 200, { ok: true, service: 'website-audit-tool' });
    }

    if (req.method === 'POST' && url.pathname === '/api/audit') {
      const body = await readJson(req);
      const websiteUrl = body.websiteUrl;
      const normalizedWebsiteUrl = websiteAuditor.normalizeWebsiteUrl(websiteUrl);
      if (!normalizedWebsiteUrl) return sendJson(res, 400, { error: 'websiteUrl must be a valid website address' });

      const review = await websiteAuditor.reviewWebsite(normalizedWebsiteUrl, {
        businessName: body.businessName,
        industry: body.industry,
      });
      return sendJson(res, 200, { review });
    }

    if (req.method === 'POST' && url.pathname === '/api/analyze-html') {
      const body = await readJson(req);
      const normalizedWebsiteUrl = websiteAuditor.normalizeWebsiteUrl(body.websiteUrl);
      if (!normalizedWebsiteUrl) return sendJson(res, 400, { error: 'websiteUrl must be a valid website address' });
      return sendJson(res, 200, {
        review: websiteAuditor.analyzeHtml({
          html: body.html,
          websiteUrl: normalizedWebsiteUrl,
          businessName: body.businessName,
          industry: body.industry,
        }),
      });
    }

    if (req.method === 'GET') {
      return serveStatic(url.pathname, res);
    }

    sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    sendJson(res, err.status || 500, { error: err.message || 'Unexpected error' });
  }
});

function serveStatic(urlPath, res) {
  const relativePath = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const filePath = path.resolve(PUBLIC_DIR, relativePath);
  if (!filePath.startsWith(PUBLIC_DIR)) return sendJson(res, 403, { error: 'Forbidden' });

  fs.readFile(filePath, (err, content) => {
    if (err) return sendJson(res, 404, { error: 'Not found' });
    res.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(filePath)] || 'application/octet-stream' });
    res.end(content);
  });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(Object.assign(new Error('Request body too large'), { status: 413 }));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (_err) {
        reject(Object.assign(new Error('Request body must be valid JSON'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Website Audit Tool running at http://localhost:${PORT}`);
  });
}

module.exports = { server };
