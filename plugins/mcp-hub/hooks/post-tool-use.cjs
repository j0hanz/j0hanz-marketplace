const fs = require('fs');
const path = require('path');
const { isMcpProject } = require('./mcp-project.cjs');
const { safeId, storePath, readStore, writeStore } = require('./drift-store.cjs');

// PostToolUse drift scanner for mcp-hub. In a project whose package.json has an
// @modelcontextprotocol/* dep (tooling excluded), scans the edited source file
// the moment Claude writes it and emits one <mcp-hub-drift> advisory citing the
// owning skill for: v1-contamination (R5), instanceof on an SDK error (R6), or
// a missing docs/mcp-decisions.md (R7). Advisory only — always exits 0.
// Mirrors hooks/session-start.cjs: sentinel-guarded stdout, fail-open, stdlib only.
// Project detection lives in hooks/mcp-project.cjs; the dedupe store filename
// lives in hooks/drift-store.cjs (hooks/session-end.cjs must agree on it).

const SOURCE_EXTS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);

// R5 -> mcp-hub:mcp-migration. The v1-contamination pattern set (spec A5).
const R5_PATTERNS = [
  /@modelcontextprotocol\/sdk(?![\w-])/,
  /\b(McpError|ErrorCode|SSEServerTransport|WebSocketClientTransport|RequestHandlerExtra)\b/,
  /\.\s*(tool|prompt|resource)\s*\(/,
  /\bsetRequestHandler\s*\(\s*[A-Za-z_$]/, // schema identifier first arg, not a string
];
// R6 -> mcp-hub:mcp-test. instanceof on an SDK error class fails cross-bundle.
const R6_PATTERN = /\binstanceof\s+(ProtocolError|SdkError|SdkHttpError|OAuthError|McpError)\b/;

// One entry per rule: which skill owns it, its display name, and its suggestion.
const RULES = {
  R5: {
    skill: 'mcp-hub:mcp-migration',
    name: 'v1-contamination',
    suggestion: 'consider migrating to the split v2 packages (see mcp-hub:mcp-migration)',
  },
  R6: {
    skill: 'mcp-hub:mcp-test',
    name: 'instanceof on SDK error',
    suggestion: 'consider using .code/.data or .isInstance() (see mcp-hub:mcp-test)',
  },
  R7: {
    skill: 'mcp-hub:mcp-planning',
    name: 'no decision record',
    suggestion:
      'consider recording decisions in docs/mcp-decisions.md first (see mcp-hub:mcp-planning)',
  },
};

// R7 is a project invariant with no per-file location, so it keys on rule alone.
function keyOf(f) {
  return f.rule === 'R7' ? 'R7' : `${f.rule}|${f.file}`;
}

function scanFile(resolved, cwd) {
  const findings = [];
  const text = fs.readFileSync(resolved, 'utf8');
  const lines = text.split(/\r?\n/);

  let r5Line = 0;
  let r6Line = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!r5Line && R5_PATTERNS.some((re) => re.test(line))) r5Line = i + 1;
    if (!r6Line && R6_PATTERN.test(line)) r6Line = i + 1;
    if (r5Line && r6Line) break;
  }

  const displayPath = path.relative(cwd, resolved) || resolved;
  if (r5Line) findings.push({ rule: 'R5', file: resolved, line: r5Line, displayPath });
  if (r6Line) findings.push({ rule: 'R6', file: resolved, line: r6Line, displayPath });
  return findings;
}

function emit(findings) {
  if (findings.length === 0) return;
  const advisories = findings.map((f) => {
    const rule = RULES[f.rule];
    const loc = f.displayPath ? ` at ${f.displayPath}:${f.line}` : '';
    return `[${rule.skill}] ${f.rule} ${rule.name}${loc} — ${rule.suggestion}.`;
  });
  const content = advisories.join('\n');
  // Defensive: refuse content carrying a reserved sentinel (mirrors session-start.cjs:18-20).
  if (content.includes('</mcp-hub-drift>') || content.includes('<system-reminder')) {
    console.error('mcp-hub: refusing to emit drift content containing reserved sentinels');
    return;
  }
  // PostToolUse is a reflex event: plain stdout is not agent-injected (it shows
  // as a transcript notice, not a system reminder Claude reads). Emit the block
  // inside hookSpecificOutput.additionalContext so it lands beside the tool
  // result. hookEventName is required or the output is silently ignored.
  const block = `<mcp-hub-drift>\n${content}\n</mcp-hub-drift>`;
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: block },
    }),
  );
}

// R2: decode PostToolUse stdin. Returns { filePath, sessionId } for a Write/Edit
// of a string file_path, else null — absent/unparseable/malformed all fail open.
function decodeInput() {
  let input;
  try {
    input = JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return null;
  }
  if (!input || !input.tool_input || typeof input.tool_input.file_path !== 'string') return null;
  if (input.tool_name !== 'Write' && input.tool_name !== 'Edit') return null;
  return { filePath: input.tool_input.file_path, sessionId: input.session_id };
}

function main() {
  const decoded = decodeInput();
  if (!decoded) return;
  const { filePath, sessionId } = decoded;

  const cwd = process.cwd();
  const resolved = path.resolve(filePath);

  // R2 / A1: must be a file within the project. ponytail: startsWith is case-sensitive;
  // a mixed-case drive letter would miss — accepted ceiling (worktrees may revisit).
  try {
    if (!resolved.startsWith(cwd + path.sep) && resolved !== cwd) return;
    if (!fs.statSync(resolved).isFile()) return;
  } catch {
    return;
  }

  // A2: source-extension gate for R5, R6, and R7. Hoisted above the R1 package
  // read so non-source writes (.md/.json) in an MCP project skip package.json.
  if (!SOURCE_EXTS.has(path.extname(resolved).toLowerCase())) return;

  // R1: MCP project gate, fail open (no/invalid package.json -> exit 0).
  try {
    if (!isMcpProject(cwd)) return;
  } catch {
    return;
  }

  // R5 / R6: per-file content scan.
  let findings;
  try {
    findings = scanFile(resolved, cwd);
  } catch {
    return;
  }

  // R7: project invariant — missing decision record. Not per-file, so no location.
  if (!fs.existsSync(path.join(cwd, 'docs', 'mcp-decisions.md'))) {
    findings.push({ rule: 'R7' });
  }

  // Short-circuit: if clean across R5, R6, and R7, skip dedupe store I/O.
  if (findings.length === 0) return;

  // R9 / R13 dedupe: emit toEmit exactly once after the try/catch.
  const sessionIdUsable = typeof sessionId === 'string' && safeId(sessionId).length > 0;
  let toEmit = findings;
  try {
    if (sessionIdUsable) {
      // ponytail: read-modify-write, no lock. Concurrent PostToolUse hooks (Claude
      // may run parallel writes) race last-writer-wins and lose dedupe. Advisory
      // only — acceptable ceiling; per-file lock if duplicate advisories appear.
      const storeFile = storePath(sessionId);
      const seen = readStore(storeFile);
      toEmit = findings.filter((f) => !seen.has(keyOf(f)));
      writeStore(storeFile, [...seen, ...toEmit.map(keyOf)]); // re-persist full set
    }
  } catch {
    toEmit = findings; // R13: outage -> emit all, dedupe skipped
  }

  emit(toEmit);
}

try {
  main();
} catch {
  // fail open on any unexpected error: no stdout, exit 0
}
