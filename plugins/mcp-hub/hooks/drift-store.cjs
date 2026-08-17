const fs = require('fs');
const os = require('os');
const path = require('path');

// Shared dedupe-store helpers for hooks/post-tool-use.cjs and hooks/session-end.cjs.
// Both hooks must agree on the store filename for a session — one hook writes it,
// the other deletes it — so the id-sanitizing and path-building logic lives here
// once instead of being re-derived (and risking drift) in each hook.

function safeId(s) {
  return String(s).replace(/[^A-Za-z0-9_-]/g, '_');
}

function storePath(sessionId) {
  return path.join(os.tmpdir(), 'mcp-hub-drift-' + safeId(sessionId) + '.json');
}

// ENOENT -> empty set (normal first run, not an outage); other read failure throws.
function readStore(p) {
  let txt;
  try {
    txt = fs.readFileSync(p, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return new Set();
    throw e;
  }
  return new Set(JSON.parse(txt));
}

function writeStore(p, keys) {
  fs.writeFileSync(p, JSON.stringify([...keys]));
}

module.exports = { safeId, storePath, readStore, writeStore };
