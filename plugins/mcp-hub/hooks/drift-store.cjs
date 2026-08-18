const fs = require('fs');
const os = require('os');
const path = require('path');

const STORE_FILE_PREFIX = 'mcp-hub-drift-';

function sanitizeSessionId(sessionId) {
  return String(sessionId).replace(/[^A-Za-z0-9_-]/g, '_');
}

function storePath(sessionId) {
  return path.join(os.tmpdir(), `${STORE_FILE_PREFIX}${sanitizeSessionId(sessionId)}.json`);
}

function hasUsableSessionId(sessionId) {
  return typeof sessionId === 'string' && sanitizeSessionId(sessionId).length > 0;
}

function readDedupeKeys(storeFile) {
  let serializedKeys;
  try {
    serializedKeys = fs.readFileSync(storeFile, 'utf8');
  } catch (error) {
    // A missing store is normal on a session's first advisory.
    if (error.code === 'ENOENT') return new Set();
    throw error;
  }
  return new Set(JSON.parse(serializedKeys));
}

function writeDedupeKeys(storeFile, keys) {
  fs.writeFileSync(storeFile, JSON.stringify([...keys]));
}

module.exports = {
  hasUsableSessionId,
  storePath,
  readDedupeKeys,
  writeDedupeKeys,
};
