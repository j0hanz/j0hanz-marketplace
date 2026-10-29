import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { detectMcpProject, escapeContextText } from './mcp-project.mjs';
import {
  drainAdvisory,
  parkAdvisory,
  pass,
  sessionId,
  toolInput,
  toolName,
  workspace,
} from './client.mjs';

const PLUGIN_KEY = 'mcp-hub-post';
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs']);
const V1_CONTAMINATION_PATTERNS = [
  /@modelcontextprotocol\/sdk(?![\w-])/,
  /\b(McpError|SSEServerTransport|WebSocketClientTransport|RequestHandlerExtra|StreamableHTTPError|JSONRPCError|ResourceReference|IsomorphicHeaders|registerToolTask|Experimental\w*Tasks|callToolStream|createMessageStream|elicitInputStream|Invalid\w*Error)\b|TaskStore\b/,
  /\b(server|mcpServer|client|mcp)\s*\.\s*(tool|prompt|resource)\s*\(/,
  /\bsetRequestHandler\s*\(\s*[A-Za-z_$]/,
];
const SDK_ERROR_INSTANCEOF_PATTERNS = [
  /\binstanceof\s+(ProtocolError|SdkError|SdkHttpError|OAuthError|McpError)\b/,
];

const ADVISORY_RULES = {
  R5: {
    skill: 'mcp-hub:mcp-migration',
    name: 'v1-contamination',
    suggestion: 'consider migrating to the split v2 packages (see mcp-hub:mcp-migration)',
  },
  R6: {
    skill: 'mcp-hub:mcp-test',
    name: 'instanceof on SDK error',
    suggestion:
      'valid on brand-aware releases; consider .isInstance() or .code/.data only for pre-brand copies, mixed versions, or worker boundaries (see mcp-hub:mcp-test)',
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

// 1-based line of the first match, or 0 when no line matches.
function firstMatchingLine(sourceLines, patterns) {
  return sourceLines.findIndex((line) => patterns.some((pattern) => pattern.test(line))) + 1;
}

function scanSourceFile(sourcePath, projectRoot) {
  const sourceLines = fs.readFileSync(sourcePath, 'utf8').split(/\r?\n/);
  const displayPath = escapeContextText(path.relative(projectRoot, sourcePath) || sourcePath);

  return [
    { rule: 'R5', line: firstMatchingLine(sourceLines, V1_CONTAMINATION_PATTERNS) },
    { rule: 'R6', line: firstMatchingLine(sourceLines, SDK_ERROR_INSTANCEOF_PATTERNS) },
  ]
    .filter((finding) => finding.line > 0)
    .map((finding) => ({ ...finding, file: sourcePath, displayPath }));
}

function formatAdvisories(findings) {
  if (findings.length === 0) return '';
  const advisories = findings.map((finding) => {
    const rule = ADVISORY_RULES[finding.rule];
    const location = finding.displayPath ? ` at ${finding.displayPath}:${finding.line}` : '';
    return `[${rule.skill}] ${finding.rule} ${rule.name}${location} — ${rule.suggestion}.`;
  });
  const content = advisories.join('\n');
  if (content.includes('</mcp-hub-drift>') || content.includes('<system-reminder')) {
    console.error('mcp-hub: refusing to emit drift content containing reserved sentinels');
    return '';
  }

  return `<mcp-hub-drift>\n${content}\n</mcp-hub-drift>`;
}

// Malformed stdin throws out to main()'s catch, which is also a silent no-op.
function readPostToolUseInput(input) {
  const filePath = toolInput(input).filePath;
  const tool = toolName(input);
  if (typeof filePath !== 'string' || (tool !== 'Write' && tool !== 'Edit')) {
    return null;
  }
  return { filePath, sessionId: sessionId(input) };
}

function resolveProjectSourceFile(filePath, projectRoot) {
  const sourcePath = path.resolve(projectRoot, filePath);
  const relativePath = path.relative(projectRoot, sourcePath);
  if (
    relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    return null;
  }
  try {
    return fs.statSync(sourcePath).isFile() ? sourcePath : null;
  } catch {
    return null;
  }
}

// Returns null for an unusable session id; the caller branches on the path.
// The store lives in os.tmpdir() and is left for the OS to reap.
function storePath(id) {
  if (typeof id !== 'string' || id.length === 0) return null;
  const safeId = id.replace(/[^A-Za-z0-9_-]/g, '_');
  return path.join(os.tmpdir(), `mcp-hub-drift-${safeId}.json`);
}

function dedupeFindings(findings, id) {
  const storeFile = storePath(id);
  if (!storeFile) return findings;
  let storedKeys = [];
  try {
    storedKeys = JSON.parse(fs.readFileSync(storeFile, 'utf8'));
  } catch {
    // Missing or corrupt store: start empty, the write below repairs it.
  }
  try {
    const seenKeys = new Set(storedKeys);
    const unseenFindings = findings.filter((finding) => !seenKeys.has(findingDedupeKey(finding)));
    fs.writeFileSync(
      storeFile,
      JSON.stringify([...seenKeys, ...unseenFindings.map(findingDedupeKey)]),
    );
    return unseenFindings;
  } catch {
    // Store failures should not suppress an otherwise useful advisory.
    return findings;
  }
}

function main() {
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  if (process.argv[2] === 'deliver') {
    process.stdout.write(drainAdvisory(PLUGIN_KEY, input));
    return;
  }
  const event = readPostToolUseInput(input);
  if (!event) {
    process.stdout.write(pass());
    return;
  }
  const { filePath, sessionId: id } = event;

  const projectRoot = workspace(input);
  const sourcePath = resolveProjectSourceFile(filePath, projectRoot);
  if (!sourcePath || !SOURCE_EXTENSIONS.has(path.extname(sourcePath).toLowerCase())) {
    process.stdout.write(pass());
    return;
  }
  const { hasV1, v2Packages } = detectMcpProject(projectRoot, path.dirname(sourcePath));
  if (!hasV1 && v2Packages.length === 0) {
    process.stdout.write(pass());
    return;
  }

  const findings = scanSourceFile(sourcePath, projectRoot);
  if (!fs.existsSync(path.join(projectRoot, 'docs', 'mcp-decisions.md'))) {
    findings.push({ rule: 'R7' });
  }
  if (findings.length === 0) {
    process.stdout.write(pass());
    return;
  }

  const block = formatAdvisories(dedupeFindings(findings, id));
  process.stdout.write(parkAdvisory(PLUGIN_KEY, input, block));
}

try {
  main();
} catch {
  process.stdout.write(pass());
  // An advisory hook must never block the edit that triggered it.
}
