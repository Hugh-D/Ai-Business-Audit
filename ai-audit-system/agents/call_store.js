const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

let db = null;
let activeStorePath = null;

function getStorePath() {
  return path.resolve(process.env.CALL_STORE_PATH || path.join(__dirname, '..', 'data', 'calls.sqlite'));
}

function ensureDb() {
  const storePath = getStorePath();
  if (db && activeStorePath === storePath) return db;

  close();
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  db = new Database(storePath);
  activeStorePath = storePath;
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS calls (
      call_id TEXT PRIMARY KEY,
      updated_at TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_calls_updated_at ON calls(updated_at DESC);
  `);

  return db;
}

function close() {
  if (!db) return;
  db.close();
  db = null;
  activeStorePath = null;
}

function save(callId, patch) {
  if (!callId) return null;
  const database = ensureDb();

  const current = get(callId) || {};
  const next = {
    ...current,
    ...patch,
    callId,
    updatedAt: new Date().toISOString(),
  };

  database.prepare(`
    INSERT INTO calls (call_id, updated_at, payload)
    VALUES (@callId, @updatedAt, @payload)
    ON CONFLICT(call_id) DO UPDATE SET
      updated_at = excluded.updated_at,
      payload = excluded.payload
  `).run({
    callId,
    updatedAt: next.updatedAt,
    payload: JSON.stringify(next),
  });

  return next;
}

function get(callId) {
  const row = ensureDb()
    .prepare('SELECT payload FROM calls WHERE call_id = ?')
    .get(callId);
  return row ? JSON.parse(row.payload) : null;
}

function list() {
  return ensureDb()
    .prepare('SELECT payload FROM calls ORDER BY updated_at DESC LIMIT 25')
    .all()
    .map(row => JSON.parse(row.payload));
}

function clear() {
  ensureDb().prepare('DELETE FROM calls').run();
}

function reload() {
  close();
  ensureDb();
}

module.exports = { save, get, list, clear, reload, close };
