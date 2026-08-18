const fs = require('fs');
const { hasUsableSessionId, storePath } = require('./drift-store.cjs');

function readSessionId() {
  try {
    const input = JSON.parse(fs.readFileSync(0, 'utf8'));
    return typeof input?.session_id === 'string' ? input.session_id : null;
  } catch {
    return null;
  }
}

function deleteDedupeStore(sessionId) {
  try {
    fs.unlinkSync(storePath(sessionId));
  } catch {
    // A missing or inaccessible store does not affect session teardown.
  }
}

function main() {
  const sessionId = readSessionId();
  if (!sessionId || !hasUsableSessionId(sessionId)) return;
  deleteDedupeStore(sessionId);
}

try {
  main();
} catch {
  // SessionEnd cleanup must never fail the enclosing session.
}
