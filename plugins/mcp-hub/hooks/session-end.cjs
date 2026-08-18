const fs = require('fs');
const { storePath } = require('./drift-store.cjs');

try {
  const { session_id: sessionId } = JSON.parse(fs.readFileSync(0, 'utf8'));
  const storeFile = storePath(sessionId);
  if (storeFile) fs.unlinkSync(storeFile);
} catch {
  // SessionEnd cleanup must never fail the session: malformed stdin, a missing
  // store, and an unwritable one are all no-ops.
}
