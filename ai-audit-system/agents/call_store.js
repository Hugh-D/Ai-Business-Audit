const calls = new Map();

function save(callId, patch) {
  if (!callId) return null;
  const current = calls.get(callId) || {};
  const next = {
    ...current,
    ...patch,
    callId,
    updatedAt: new Date().toISOString(),
  };
  calls.set(callId, next);
  return next;
}

function get(callId) {
  return calls.get(callId) || null;
}

function list() {
  return Array.from(calls.values())
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .slice(0, 25);
}

module.exports = { save, get, list };
