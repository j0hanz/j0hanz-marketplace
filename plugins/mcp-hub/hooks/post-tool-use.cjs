const fs = require('fs');
const path = require('path');
const { isMcpProject } = require('./mcp-project.cjs');
const {
  hasUsableSessionId,
  storePath,
  readDedupeKeys,
  writeDedupeKeys,
} = require('./drift-store.cjs');

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);
const V1_CONTAMINATION_PATTERNS = [
  /@modelcontextprotocol\/sdk(?![\w-])/,
  /\b(McpError|ErrorCode|SSEServerTransport|WebSocketClientTransport|RequestHandlerExtra)\b/,
  /\.\s*(tool|prompt|resource)\s*\(/,
  /\bsetRequestHandler\s*\(\s*[A-Za-z_$]/,
];
const SDK_ERROR_INSTANCEOF_PATTERN =
  /\binstanceof\s+(ProtocolError|SdkError|SdkHttpError|OAuthError|McpError)\b/;

const ADVISORY_RULES = {
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

function findingDedupeKey(finding) {
  return finding.rule === 'R7' ? 'R7' : `${finding.rule}|${finding.file}`;
}

function scanSourceFile(sourcePath, projectRoot) {
  const sourceLines = fs.readFileSync(sourcePath, 'utf8').split(/\r?\n/);

  let v1ContaminationLine = 0;
  let sdkErrorInstanceofLine = 0;
  for (let index = 0; index < sourceLines.length; index++) {
    const line = sourceLines[index];
    if (!v1ContaminationLine && V1_CONTAMINATION_PATTERNS.some((pattern) => pattern.test(line))) {
      v1ContaminationLine = index + 1;
    }
    if (!sdkErrorInstanceofLine && SDK_ERROR_INSTANCEOF_PATTERN.test(line)) {
      sdkErrorInstanceofLine = index + 1;
    }
    if (v1ContaminationLine && sdkErrorInstanceofLine) break;
  }

  const displayPath = path.relative(projectRoot, sourcePath) || sourcePath;
  const findings = [];
  if (v1ContaminationLine) {
    findings.push({
      rule: 'R5',
      file: sourcePath,
      line: v1ContaminationLine,
      displayPath,
    });
  }
  if (sdkErrorInstanceofLine) {
    findings.push({
      rule: 'R6',
      file: sourcePath,
      line: sdkErrorInstanceofLine,
      displayPath,
    });
  }
  return findings;
}

function emitAdvisories(findings) {
  if (findings.length === 0) return;
  const advisories = findings.map((finding) => {
    const rule = ADVISORY_RULES[finding.rule];
    const location = finding.displayPath ? ` at ${finding.displayPath}:${finding.line}` : '';
    return `[${rule.skill}] ${finding.rule} ${rule.name}${location} — ${rule.suggestion}.`;
  });
  const content = advisories.join('\n');
  if (content.includes('</mcp-hub-drift>') || content.includes('<system-reminder')) {
    console.error('mcp-hub: refusing to emit drift content containing reserved sentinels');
    return;
  }

  // Reflex hooks must return this shape for advisory context to reach the agent.
  const block = `<mcp-hub-drift>\n${content}\n</mcp-hub-drift>`;
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: block },
    }),
  );
}

function readPostToolUseInput() {
  try {
    const input = JSON.parse(fs.readFileSync(0, 'utf8'));
    const filePath = input?.tool_input?.file_path;
    if (
      typeof filePath !== 'string' ||
      (input?.tool_name !== 'Write' && input?.tool_name !== 'Edit')
    ) {
      return null;
    }
    return { filePath, sessionId: input.session_id };
  } catch {
    return null;
  }
}

function isPathInsideProject(projectRoot, candidatePath) {
  const relativePath = path.relative(projectRoot, candidatePath);
  return (
    relativePath !== '..' &&
    !relativePath.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativePath)
  );
}

function resolveProjectSourceFile(filePath, projectRoot) {
  const sourcePath = path.resolve(projectRoot, filePath);
  if (!isPathInsideProject(projectRoot, sourcePath)) return null;
  try {
    return fs.statSync(sourcePath).isFile() ? sourcePath : null;
  } catch {
    return null;
  }
}

function dedupeFindings(findings, sessionId) {
  if (!hasUsableSessionId(sessionId)) return findings;
  try {
    const storeFile = storePath(sessionId);
    const seenKeys = readDedupeKeys(storeFile);
    const unseenFindings = findings.filter((finding) => !seenKeys.has(findingDedupeKey(finding)));
    writeDedupeKeys(storeFile, [...seenKeys, ...unseenFindings.map(findingDedupeKey)]);
    return unseenFindings;
  } catch {
    // Store failures should not suppress an otherwise useful advisory.
    return findings;
  }
}

function main() {
  const event = readPostToolUseInput();
  if (!event) return;
  const { filePath, sessionId } = event;

  const projectRoot = process.cwd();
  const sourcePath = resolveProjectSourceFile(filePath, projectRoot);
  if (!sourcePath || !SOURCE_EXTENSIONS.has(path.extname(sourcePath).toLowerCase())) return;
  if (!isMcpProject(projectRoot)) return;

  const findings = scanSourceFile(sourcePath, projectRoot);
  if (!fs.existsSync(path.join(projectRoot, 'docs', 'mcp-decisions.md'))) {
    findings.push({ rule: 'R7' });
  }
  if (findings.length === 0) return;

  emitAdvisories(dedupeFindings(findings, sessionId));
}

try {
  main();
} catch {
  // An advisory hook must never block the edit that triggered it.
}
