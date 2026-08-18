import assert from 'node:assert/strict';
import {
  chmodSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// The hook is CommonJS. Under this repo's `type: module` it will not run in
// place, so the net copies the source into a CJS fixture and runs it there —
// the same CJS context it gets in production (plugin cache dir, no
// `type:module` parent). Mirrors test/session-start.test.mjs.
const HOOKS_DIR = fileURLToPath(new URL('../hooks/', import.meta.url));

// Mirrors storePath() in post-tool-use.cjs.
const storePath = (sessionId) =>
  join(tmpdir(), `mcp-hub-drift-${sessionId.replace(/[^A-Za-z0-9_-]/g, '_')}.json`);

const MCP_PKG = JSON.stringify({ dependencies: { '@modelcontextprotocol/server': '2.0.0' } });
const TOOLING_PKG = JSON.stringify({
  devDependencies: {
    '@modelcontextprotocol/codemod': '1.0.0',
    '@modelcontextprotocol/inspector': '1.0.0',
  },
});
const REACT_PKG = JSON.stringify({ dependencies: { react: '1.0.0' } });

const makeHook = () => {
  const root = mkdtempSync(join(tmpdir(), 'mcphub-drift-'));
  // Copies the whole hooks/ dir (not just post-tool-use.cjs) so the sibling
  // mcp-project.cjs module it requires travels with it.
  cpSync(HOOKS_DIR, join(root, 'hooks'), { recursive: true });
  return root;
};

// Project cwd: package.json + source files + optional docs/mcp-decisions.md.
const makeProj = (pkgBody, files, opts = {}) => {
  const cwd = mkdtempSync(join(tmpdir(), 'mcphub-proj-'));
  if (pkgBody !== null) writeFileSync(join(cwd, 'package.json'), pkgBody);
  for (const [rel, content] of Object.entries(files || {})) {
    const full = join(cwd, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content);
  }
  if (opts.decisions) {
    mkdirSync(join(cwd, 'docs'), { recursive: true });
    writeFileSync(join(cwd, 'docs', 'mcp-decisions.md'), '# decisions\n');
  }
  return cwd;
};

const payload = (filePath, sessionId = 's1', toolName = 'Write') => ({
  tool_name: toolName,
  tool_input: { file_path: filePath },
  session_id: sessionId,
});

const run = (hookRoot, cwd, pl) => {
  const r = spawnSync(process.execPath, [join(hookRoot, 'hooks', 'post-tool-use.cjs')], {
    cwd,
    encoding: 'utf8',
    input: pl == null ? '' : typeof pl === 'string' ? pl : JSON.stringify(pl),
  });
  return { stdout: r.stdout ?? '', stderr: r.stderr ?? '', status: r.status };
};

const clean = (hookRoot, cwd, sessionId) => {
  rmSync(hookRoot, { recursive: true, force: true });
  rmSync(cwd, { recursive: true, force: true });
  if (sessionId) rmSync(storePath(sessionId), { force: true });
};

// The hook emits JSON with the advisory inside hookSpecificOutput.additionalContext
// (PostToolUse is a reflex event; plain stdout is not agent-injected). Decode it
// before asserting on path/line, since JSON-escaping doubles backslashes.
const ctxOf = (stdout) => {
  if (!stdout) return '';
  return JSON.parse(stdout).hookSpecificOutput.additionalContext;
};

// --- R1: project gate -----------------------------------------------------

test('R1: a non-MCP project (react only) emits nothing even for a v1 symbol', () => {
  const hook = makeHook();
  const cwd = makeProj(REACT_PKG, {
    'src/a.ts': "import { Server } from '@modelcontextprotocol/sdk';\n",
  });
  const sid = 'r1-react';
  try {
    const { stdout, status } = run(hook, cwd, payload(join(cwd, 'src', 'a.ts'), sid));
    assert.equal(stdout, '');
    assert.equal(status, 0);
  } finally {
    clean(hook, cwd, sid);
  }
});

test('R1: no package.json at cwd emits nothing (fail open)', () => {
  const hook = makeHook();
  const cwd = makeProj(null, {
    'src/a.ts': "import { Server } from '@modelcontextprotocol/sdk';\n",
  });
  const sid = 'r1-nopkg';
  try {
    const { stdout, status } = run(hook, cwd, payload(join(cwd, 'src', 'a.ts'), sid));
    assert.equal(stdout, '');
    assert.equal(status, 0);
  } finally {
    clean(hook, cwd, sid);
  }
});

test('R1: a tooling-only project (codemod/inspector, no server/sdk) does not scan', () => {
  const hook = makeHook();
  const cwd = makeProj(TOOLING_PKG, {
    'src/a.ts': "import { Server } from '@modelcontextprotocol/sdk';\n",
  });
  const sid = 'r1-tooling';
  try {
    const { stdout, status } = run(hook, cwd, payload(join(cwd, 'src', 'a.ts'), sid));
    assert.equal(stdout, ''); // v1 symbol present, but hook did not scan
    assert.equal(status, 0);
  } finally {
    clean(hook, cwd, sid);
  }
});

test('R1: an MCP dependency in a workspace package.json is detected', () => {
  const hook = makeHook();
  const cwd = makeProj(
    JSON.stringify({ private: true, workspaces: ['packages/*'] }),
    {
      'packages/server/package.json': MCP_PKG,
      'packages/server/src/a.ts': "import { Server } from '@modelcontextprotocol/sdk';\n",
    },
    { decisions: true },
  );
  const sid = 'r1-monorepo';
  try {
    const { stdout, status } = run(
      hook,
      cwd,
      payload(join(cwd, 'packages', 'server', 'src', 'a.ts'), sid),
    );
    assert.equal(status, 0);
    assert.match(stdout, /mcp-hub:mcp-migration/);
  } finally {
    clean(hook, cwd, sid);
  }
});

// detectMcpProject reads peerDependencies and optionalDependencies too.
for (const depField of ['peerDependencies', 'optionalDependencies']) {
  test(`R1: an MCP package under ${depField} is detected`, () => {
    const pkg = JSON.stringify({ [depField]: { '@modelcontextprotocol/server': '2.0.0' } });
    const hook = makeHook();
    const cwd = makeProj(
      pkg,
      { 'src/a.ts': "import { Server } from '@modelcontextprotocol/sdk';\n" },
      { decisions: true },
    );
    const sid = `r1-${depField}`;
    try {
      const { stdout, status } = run(hook, cwd, payload(join(cwd, 'src', 'a.ts'), sid));
      assert.equal(status, 0);
      assert.match(stdout, /mcp-hub:mcp-migration/);
    } finally {
      clean(hook, cwd, sid);
    }
  });
}

test('R1: a BOM-prefixed root package.json is still detected', () => {
  const hook = makeHook();
  const cwd = makeProj(
    String.fromCharCode(0xfeff) + MCP_PKG,
    { 'src/a.ts': "import { Server } from '@modelcontextprotocol/sdk';\n" },
    { decisions: true },
  );
  const sid = 'r1-bom';
  try {
    const { stdout, status } = run(hook, cwd, payload(join(cwd, 'src', 'a.ts'), sid));
    assert.equal(status, 0);
    assert.match(stdout, /mcp-hub:mcp-migration/);
  } finally {
    clean(hook, cwd, sid);
  }
});

// --- R2: stdin / file_path malformed --------------------------------------

test('R2: empty stdin emits nothing, exit 0', () => {
  const hook = makeHook();
  const cwd = makeProj(MCP_PKG, {}, { decisions: true });
  try {
    const { stdout, status } = run(hook, cwd, '');
    assert.equal(stdout, '');
    assert.equal(status, 0);
  } finally {
    clean(hook, cwd);
  }
});

test('R2: {} (no file_path) emits nothing, exit 0', () => {
  const hook = makeHook();
  const cwd = makeProj(MCP_PKG, {}, { decisions: true });
  try {
    const { stdout, status } = run(hook, cwd, '{}');
    assert.equal(stdout, '');
    assert.equal(status, 0);
  } finally {
    clean(hook, cwd);
  }
});

test('R2: a file_path that does not exist emits nothing, exit 0', () => {
  const hook = makeHook();
  const cwd = makeProj(MCP_PKG, {}, { decisions: true });
  const sid = 'r2-missing';
  try {
    const { stdout, status } = run(hook, cwd, payload(join(cwd, 'src', 'missing.ts'), sid));
    assert.equal(stdout, '');
    assert.equal(status, 0);
  } finally {
    clean(hook, cwd, sid);
  }
});

for (const extension of ['.mts', '.cts']) {
  test(`R2: ${extension} source files are scanned`, () => {
    const hook = makeHook();
    const sourceFile = `src/server${extension}`;
    const cwd = makeProj(
      MCP_PKG,
      { [sourceFile]: "import { Server } from '@modelcontextprotocol/sdk';\n" },
      { decisions: true },
    );
    const sid = `r2-${extension.slice(1)}`;
    try {
      const { stdout, status } = run(hook, cwd, payload(join(cwd, sourceFile), sid));
      assert.equal(status, 0);
      assert.match(ctxOf(stdout), /mcp-hub:mcp-migration/);
    } finally {
      clean(hook, cwd, sid);
    }
  });
}

test('R2: a non-Write/Edit tool_name (NotebookEdit) emits nothing, exit 0', () => {
  const hook = makeHook();
  const cwd = makeProj(
    MCP_PKG,
    { 'src/a.ts': "import { Server } from '@modelcontextprotocol/sdk';\n" },
    { decisions: true },
  );
  const sid = 'r2-toolname';
  try {
    const { stdout, status } = run(
      hook,
      cwd,
      payload(join(cwd, 'src', 'a.ts'), sid, 'NotebookEdit'),
    );
    assert.equal(stdout, '');
    assert.equal(status, 0);
  } finally {
    clean(hook, cwd, sid);
  }
});

// --- R3 / R8: block shape -------------------------------------------------

test('R3/R8: a v1 symbol emits exactly one <mcp-hub-drift> block with skill, location, suggestion', () => {
  const hook = makeHook();
  const cwd = makeProj(
    MCP_PKG,
    { 'src/server.ts': "import { Server } from '@modelcontextprotocol/sdk';\n" },
    { decisions: true },
  );
  const sid = 'r3-block';
  try {
    const { stdout, status } = run(hook, cwd, payload(join(cwd, 'src', 'server.ts'), sid));
    assert.equal(status, 0);
    // PostToolUse is a reflex event: the block must travel inside
    // hookSpecificOutput.additionalContext to reach the agent, not as plain stdout.
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.hookSpecificOutput.hookEventName, 'PostToolUse');
    const ctx = parsed.hookSpecificOutput.additionalContext;
    assert.equal((ctx.match(/<mcp-hub-drift>/g) || []).length, 1);
    assert.equal((ctx.match(/<\/mcp-hub-drift>/g) || []).length, 1);
    assert.match(ctx, /mcp-hub:mcp-migration/);
    assert.match(ctx, /:\d+/); // path:line
    assert.match(ctx, /consider/); // suggestion phrase
    assert.doesNotMatch(ctx, /<system-reminder>/);
  } finally {
    clean(hook, cwd, sid);
  }
});

test('R8: a path character needing escaping is escaped in the advisory', () => {
  const hook = makeHook();
  const cwd = makeProj(
    MCP_PKG,
    { 'src/a&b.ts': "import { Server } from '@modelcontextprotocol/sdk';\n" },
    { decisions: true },
  );
  const sid = 'r8-escape';
  try {
    const { stdout, status } = run(hook, cwd, payload(join(cwd, 'src', 'a&b.ts'), sid));
    assert.equal(status, 0);
    const ctx = ctxOf(stdout);
    assert.match(ctx, /a\\u0026b\.ts:/);
  } finally {
    clean(hook, cwd, sid);
  }
});

// --- R4: no finding -------------------------------------------------------

test('R4: a clean source file (no v1, no instanceof, decisions present) emits nothing', () => {
  const hook = makeHook();
  const cwd = makeProj(
    MCP_PKG,
    { 'src/clean.ts': 'export const add = (a, b) => a + b;\n' },
    { decisions: true },
  );
  const sid = 'r4-clean';
  try {
    const { stdout, status } = run(hook, cwd, payload(join(cwd, 'src', 'clean.ts'), sid));
    assert.equal(stdout, '');
    assert.equal(status, 0);
  } finally {
    clean(hook, cwd, sid);
  }
});

test('R4: an empty source file emits nothing', () => {
  const hook = makeHook();
  const cwd = makeProj(MCP_PKG, { 'src/empty.ts': '' }, { decisions: true });
  const sid = 'r4-empty';
  try {
    const { stdout, status } = run(hook, cwd, payload(join(cwd, 'src', 'empty.ts'), sid));
    assert.equal(stdout, '');
    assert.equal(status, 0);
  } finally {
    clean(hook, cwd, sid);
  }
});

// --- R5: v1-contamination -> mcp-hub:mcp-migration ------------------------

// [what the source shows, source file, source text, cites mcp-hub:mcp-migration]
const R5_CASES = [
  [
    'import from @modelcontextprotocol/sdk',
    'src/s.ts',
    "import { Server } from '@modelcontextprotocol/sdk';\n",
    true,
  ],
  [
    'setRequestHandler with a schema first arg',
    'src/h.ts',
    'server.setRequestHandler(CallToolRequestSchema, h);\n',
    true,
  ],
  ['variadic .tool(', 'src/t.ts', "server.tool('n', schema, h);\n", true],
  [
    'a removed tasks API (InMemoryTaskStore)',
    'src/t.ts',
    'const store = new InMemoryTaskStore();\n',
    true,
  ],
  [
    'a renamed type (StreamableHTTPError)',
    'src/t.ts',
    "catch (e) { if (e.name === 'StreamableHTTPError') x; }\n",
    true,
  ],
  [
    'a v1 import of ErrorCode',
    'src/t.ts',
    "import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';\n",
    true,
  ],
  ['v2 .registerTool(', 'src/t.ts', "server.registerTool('n', cfg, h);\n", false],
  [
    'a .md file with @modelcontextprotocol/sdk prose',
    'README.md',
    'See @modelcontextprotocol/sdk for v1.\n',
    false,
  ],
  ['the v2 name JSONRPCErrorResponse', 'src/t.ts', 'const r: JSONRPCErrorResponse = x;\n', false],
  [
    'the v2 name ResourceTemplateReference',
    'src/t.ts',
    'const r: ResourceTemplateReference = x;\n',
    false,
  ],
  [
    'an inquirer .prompt( call',
    'src/t.ts',
    'const answers = await inquirer.prompt(questions);\n',
    false,
  ],
  [
    'a project-local ErrorCode enum',
    'src/t.ts',
    'export enum ErrorCode { NotFound = 404 }\n',
    false,
  ],
];

for (const [index, [what, sourceFile, source, cites]] of R5_CASES.entries()) {
  const outcome = cites ? 'cites mcp-hub:mcp-migration' : 'emits no R5 advisory';
  test(`R5: ${what} ${outcome}`, () => {
    const hook = makeHook();
    const cwd = makeProj(MCP_PKG, { [sourceFile]: source }, { decisions: true });
    const sid = `r5-${index}`;
    try {
      const { stdout } = run(hook, cwd, payload(join(cwd, sourceFile), sid));
      if (cites) assert.match(stdout, /mcp-hub:mcp-migration/);
      else assert.equal(stdout, '');
    } finally {
      clean(hook, cwd, sid);
    }
  });
}

// --- R6: instanceof on SDK error -> mcp-hub:mcp-test ----------------------

test('R6: instanceof ProtocolError cites mcp-hub:mcp-test', () => {
  const hook = makeHook();
  const cwd = makeProj(
    MCP_PKG,
    { 'src/c.ts': 'if (e instanceof ProtocolError) x;\n' },
    { decisions: true },
  );
  const sid = 'r6-inst';
  try {
    const { stdout } = run(hook, cwd, payload(join(cwd, 'src', 'c.ts'), sid));
    assert.match(stdout, /mcp-hub:mcp-test/);
  } finally {
    clean(hook, cwd, sid);
  }
});

// R6 advisory regex also matches the other v2 SDK error class names.
for (const className of ['SdkError', 'SdkHttpError', 'OAuthError', 'McpError']) {
  test(`R6: instanceof ${className} cites mcp-hub:mcp-test`, () => {
    const hook = makeHook();
    const cwd = makeProj(
      MCP_PKG,
      { 'src/c.ts': `if (e instanceof ${className}) x;\n` },
      { decisions: true },
    );
    const sid = `r6-${className.toLowerCase()}`;
    try {
      const { stdout } = run(hook, cwd, payload(join(cwd, 'src', 'c.ts'), sid));
      assert.match(stdout, /mcp-hub:mcp-test/);
    } finally {
      clean(hook, cwd, sid);
    }
  });
}

test('R6: instanceof Error (generic) emits no R6 advisory', () => {
  const hook = makeHook();
  const cwd = makeProj(
    MCP_PKG,
    { 'src/c.ts': 'if (e instanceof Error) x;\n' },
    { decisions: true },
  );
  const sid = 'r6-err';
  try {
    const { stdout } = run(hook, cwd, payload(join(cwd, 'src', 'c.ts'), sid));
    assert.equal(stdout, '');
  } finally {
    clean(hook, cwd, sid);
  }
});

test('R6: a .md file with instanceof ProtocolError prose emits no R6 advisory', () => {
  const hook = makeHook();
  const cwd = makeProj(
    MCP_PKG,
    { 'note.md': 'use instanceof ProtocolError to check\n' },
    { decisions: true },
  );
  const sid = 'r6-md';
  try {
    const { stdout } = run(hook, cwd, payload(join(cwd, 'note.md'), sid));
    assert.equal(stdout, '');
  } finally {
    clean(hook, cwd, sid);
  }
});

// --- R7: missing decision record -> mcp-hub:mcp-planning -----------------

test('R7: MCP source edit with no docs/mcp-decisions.md cites mcp-hub:mcp-planning', () => {
  const hook = makeHook();
  const cwd = makeProj(MCP_PKG, { 'src/server.ts': 'export const x = 1;\n' }); // no decisions
  const sid = 'r7-none';
  try {
    const { stdout } = run(hook, cwd, payload(join(cwd, 'src', 'server.ts'), sid));
    assert.match(stdout, /mcp-hub:mcp-planning/);
  } finally {
    clean(hook, cwd, sid);
  }
});

test('R7: with docs/mcp-decisions.md present, a clean source edit emits no R7 advisory', () => {
  const hook = makeHook();
  const cwd = makeProj(MCP_PKG, { 'src/server.ts': 'export const x = 1;\n' }, { decisions: true });
  const sid = 'r7-exists';
  try {
    const { stdout } = run(hook, cwd, payload(join(cwd, 'src', 'server.ts'), sid));
    assert.equal(stdout, '');
  } finally {
    clean(hook, cwd, sid);
  }
});

test('R7: a Write to README.md (non-source) emits no R7 advisory', () => {
  const hook = makeHook();
  const cwd = makeProj(MCP_PKG, { 'README.md': '# hi\n' }); // no decisions, non-source
  const sid = 'r7-md';
  try {
    const { stdout } = run(hook, cwd, payload(join(cwd, 'README.md'), sid));
    assert.equal(stdout, '');
  } finally {
    clean(hook, cwd, sid);
  }
});

// --- R9: dedupe per session -----------------------------------------------

test('R9: the same (rule, file) match emits once per session', () => {
  const hook = makeHook();
  const cwd = makeProj(
    MCP_PKG,
    { 'src/a.ts': "import { Server } from '@modelcontextprotocol/sdk';\n" },
    { decisions: true },
  );
  const sid = 'r9-samefile';
  const file = join(cwd, 'src', 'a.ts');
  try {
    const r1 = run(hook, cwd, payload(file, sid));
    const r2 = run(hook, cwd, payload(file, sid));
    assert.match(r1.stdout, /mcp-hub:mcp-migration/);
    assert.equal(r2.stdout, '');
  } finally {
    clean(hook, cwd, sid);
  }
});

test('R9: different files in the same session each emit once', () => {
  const hook = makeHook();
  const cwd = makeProj(
    MCP_PKG,
    {
      'src/a.ts': "import { Server } from '@modelcontextprotocol/sdk';\n",
      'src/b.ts': "import { Server } from '@modelcontextprotocol/sdk';\n",
    },
    { decisions: true },
  );
  const sid = 'r9-difffile';
  try {
    const r1 = run(hook, cwd, payload(join(cwd, 'src', 'a.ts'), sid));
    const r2 = run(hook, cwd, payload(join(cwd, 'src', 'b.ts'), sid));
    assert.match(ctxOf(r1.stdout), /src[\\/]a\.ts:/); // win32 backslash or posix slash
    assert.match(ctxOf(r2.stdout), /src[\\/]b\.ts:/);
  } finally {
    clean(hook, cwd, sid);
  }
});

test('R9: R7 emits once per session across two source edits', () => {
  const hook = makeHook();
  const cwd = makeProj(MCP_PKG, {
    'src/a.ts': 'export const x = 1;\n',
    'src/b.ts': 'export const y = 2;\n',
  }); // no decisions
  const sid = 'r9-r7';
  try {
    const r1 = run(hook, cwd, payload(join(cwd, 'src', 'a.ts'), sid));
    const r2 = run(hook, cwd, payload(join(cwd, 'src', 'b.ts'), sid));
    assert.match(r1.stdout, /mcp-hub:mcp-planning/);
    assert.equal(r2.stdout, '');
  } finally {
    clean(hook, cwd, sid);
  }
});

// --- R13: dedupe outage ---------------------------------------------------

test('R13: a match with session_id omitted emits without deduping, exit 0', () => {
  const hook = makeHook();
  const cwd = makeProj(
    MCP_PKG,
    { 'src/a.ts': "import { Server } from '@modelcontextprotocol/sdk';\n" },
    { decisions: true },
  );
  const file = join(cwd, 'src', 'a.ts');
  try {
    const r1 = run(hook, cwd, { tool_name: 'Write', tool_input: { file_path: file } });
    const r2 = run(hook, cwd, { tool_name: 'Write', tool_input: { file_path: file } });
    assert.match(r1.stdout, /mcp-hub:mcp-migration/);
    assert.equal(r1.status, 0);
    assert.match(r2.stdout, /mcp-hub:mcp-migration/); // dedupe skipped -> re-emits
    assert.equal(r2.status, 0);
  } finally {
    clean(hook, cwd);
  }
});

test('R13: a read-only store file still emits on the next run (dedupe skipped)', () => {
  const hook = makeHook();
  const cwd = makeProj(
    MCP_PKG,
    { 'src/a.ts': "import { Server } from '@modelcontextprotocol/sdk';\n" },
    { decisions: true },
  );
  const sid = 'r13-outage';
  const file = join(cwd, 'src', 'a.ts');
  const sp = storePath(sid);
  try {
    const r1 = run(hook, cwd, payload(file, sid));
    assert.match(r1.stdout, /mcp-hub:mcp-migration/); // run 1 emits + persists store
    chmodSync(sp, 0o400); // read-only store FILE: write throws (EPERM on win32) -> R13
    const r2 = run(hook, cwd, payload(file, sid));
    assert.match(r2.stdout, /mcp-hub:mcp-migration/); // outage -> dedupe skipped -> re-emits
    assert.equal(r2.status, 0);
  } finally {
    try {
      chmodSync(sp, 0o600);
    } catch {
      // store may already be gone
    }
    clean(hook, cwd, sid);
  }
});

test('R13: a corrupt store file is repaired and the advisory still emits', () => {
  const hook = makeHook();
  const cwd = makeProj(
    MCP_PKG,
    { 'src/a.ts': "import { Server } from '@modelcontextprotocol/sdk';\n" },
    { decisions: true },
  );
  const sid = 'r13-corrupt';
  try {
    writeFileSync(storePath(sid), 'not json');
    const { stdout, status } = run(hook, cwd, payload(join(cwd, 'src', 'a.ts'), sid));
    assert.equal(status, 0);
    assert.match(stdout, /mcp-hub:mcp-migration/);
    const keys = JSON.parse(readFileSync(storePath(sid), 'utf8'));
    assert.ok(Array.isArray(keys));
    assert.ok(keys.length > 0);
  } finally {
    clean(hook, cwd, sid);
  }
});

// --- R11: loose performance smoke -----------------------------------------

test('R11: a 20k-line source file matching no rule scans within 2000 ms', () => {
  const hook = makeHook();
  const big = Array.from({ length: 20000 }, (_, i) => `const n${i} = ${i};`).join('\n') + '\n';
  const cwd = makeProj(MCP_PKG, { 'src/big.ts': big }, { decisions: true });
  const sid = 'r11-smoke';
  try {
    const start = Date.now();
    const { status } = run(hook, cwd, payload(join(cwd, 'src', 'big.ts'), sid));
    const ms = Date.now() - start;
    assert.equal(status, 0);
    assert.ok(ms < 2000, `scan took ${ms} ms`);
  } finally {
    clean(hook, cwd, sid);
  }
});
