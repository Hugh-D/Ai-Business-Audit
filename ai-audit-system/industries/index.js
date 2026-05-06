const fs = require('fs');
const path = require('path');

// Auto-discovers every *.json file in this directory except _template.json.
// Adding a new industry requires only dropping a new JSON file here — no code changes.

const cache = {};

function load() {
  const dir = __dirname;
  const files = fs.readdirSync(dir).filter(
    f => f.endsWith('.json') && !f.startsWith('_')
  );

  for (const file of files) {
    const config = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    if (!config.id) throw new Error(`Industry config ${file} is missing required "id" field`);
    cache[config.id] = config;
  }

  return cache;
}

function get(industryId) {
  if (Object.keys(cache).length === 0) load();
  const config = cache[industryId];
  if (!config) {
    const err = new Error(`Unknown industry: "${industryId}". Available: ${list().join(', ')}`);
    err.status = 404;
    throw err;
  }
  return config;
}

function list() {
  if (Object.keys(cache).length === 0) load();
  return Object.keys(cache);
}

module.exports = { load, get, list };
