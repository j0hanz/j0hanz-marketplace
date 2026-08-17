const fs = require('fs');
const os = require('os');
const path = require('path');

// SessionEnd cleanup for mcp-hub: removes this session's dedupe scratch store
// written by hooks/post-tool-use.cjs to os.tmpdir() (mcp-hub-drift-<sid>.json),
// so per-session store files do not accumulate across sessions. Fail open on
// every path — no payload, no store, or unlink failure all exit 0 silently.
// stdlib only; mirrors post-tool-use.cjs safeId + storePath.

try {
  let input;
  try {
    input = JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    input = null;
  }
  const sid = input && typeof input.session_id === 'string' ? input.session_id : null;
  if (sid) {
    const safeId = sid.replace(/[^A-Za-z0-9_-]/g, '_');
    try {
      fs.unlinkSync(path.join(os.tmpdir(), 'mcp-hub-drift-' + safeId + '.json'));
    } catch {
      // already gone or unreadable -> nothing to clean
    }
  }
} catch {
  // never fail a SessionEnd hook over cleanup
}
