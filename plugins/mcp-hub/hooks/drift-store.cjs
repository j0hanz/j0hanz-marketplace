const fs = require('fs');
const os = require('os');
const path = require('path');

const STORE_FILE_PREFIX = 'mcp-hub-drift-';

// Returns null for an unusable session id; callers branch on the path, not on a
// separate predicate.
function storePath(sessionId) {
  if (typeof sessionId !== 'string' || sessionId.length === 0) return null;
  const safeId = sessionId.replace(/[^A-Za-z0-9_-]/g, '_');
  return path.join(os.tmpdir(), `${STORE_FILE_PREFIX}${safeId}.json`);
}

function readDedupeKeys(storeFile) {
  try {
    return new Set(JSON.parse(fs.readFileSync(storeFile, 'utf8')));
  } catch {
    return new Set();
  }
}

function writeDedupeKeys(storeFile, keys) {
  fs.writeFileSync(storeFile, JSON.stringify([...keys]));
}

module.exports = { storePath, readDedupeKeys, writeDedupeKeys };
