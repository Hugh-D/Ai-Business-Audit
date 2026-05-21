const fs = require('fs');
const path = require('path');

const calls = new Map();
let loaded = false;

function getStorePath() {
  return process.env.CALL_STORE_PATH || path.join(__dirname, '..', 'data', 'calls.json');
}

function ensureLoaded() {
  if (loaded) return;
  loaded = true;

  try {
    const raw = fs.readFileSync(getStorePath(), 'utf8');
    const savedCalls = JSON.parse(raw);
    if (!Array.isArray(savedCalls)) return;

    calls.clear();
    for (const call of savedCalls) {
      if (call && call.callId) {
        calls.set(call.callId, call);
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn(`Could not load call store: ${err.message}`);
    }
  }
}

function persist() {
  const storePath = getStorePath();
  fs.mkdirSync(path.dirname(storePath), { recursive: true });

  const tmpPath = `${storePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(Array.from(calls.values()), null, 2));
  fs.renameSync(tmpPath, storePath);
}

function save(callId, patch) {
  if (!callId) return null;
  ensureLoaded();

  const current = calls.get(callId) || {};
  const next = {
    ...current,
    ...patch,
    callId,
    updatedAt: new Date().toISOString(),
  };
  calls.set(callId, next);
  persist();
  return next;
}

function get(callId) {
  ensureLoaded();
  return calls.get(callId) || null;
}

function list() {
  ensureLoaded();
  return Array.from(calls.values())
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .slice(0, 25);
}

function clear() {
  ensureLoaded();
  calls.clear();
  persist();
}

function reload() {
  loaded = false;
  calls.clear();
  ensureLoaded();
}

module.exports = { save, get, list, clear, reload };
