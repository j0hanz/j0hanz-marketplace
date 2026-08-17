const fs = require('fs');
const path = require('path');

// Shared MCP-project detection for hooks/session-start.cjs and hooks/post-tool-use.cjs.
// One place for the tooling-exclusion list and the v1/v2 dependency split so the
// two hooks can't drift out of sync on what counts as an MCP project.

const TOOLING = ['@modelcontextprotocol/codemod', '@modelcontextprotocol/inspector'];

// Reads package.json at cwd and splits its @modelcontextprotocol/* deps into v1
// (the single `sdk` package) vs v2 (split packages, tooling excluded). Throws on
// missing/invalid package.json — callers decide whether that means fail-open.
function detectMcpProject(cwd) {
  const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
  const depNames = Object.keys(
    Object.assign(
      {},
      pkg.dependencies,
      pkg.devDependencies,
      pkg.peerDependencies,
      pkg.optionalDependencies,
    ),
  );
  const mcpDeps = depNames.filter((n) => n.startsWith('@modelcontextprotocol/'));
  const hasV1 = mcpDeps.includes('@modelcontextprotocol/sdk');
  const v2Packages = mcpDeps.filter(
    (n) => n !== '@modelcontextprotocol/sdk' && !TOOLING.includes(n),
  );
  return { hasV1, v2Packages };
}

function isMcpProject(cwd) {
  const { hasV1, v2Packages } = detectMcpProject(cwd);
  return hasV1 || v2Packages.length > 0;
}

module.exports = { detectMcpProject, isMcpProject };
