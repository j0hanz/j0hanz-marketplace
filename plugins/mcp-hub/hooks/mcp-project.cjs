const fs = require('fs');
const path = require('path');

const MCP_PACKAGE_PREFIX = '@modelcontextprotocol/';
const V1_PACKAGE = '@modelcontextprotocol/sdk';
const TOOLING_PACKAGES = new Set([
  '@modelcontextprotocol/codemod',
  '@modelcontextprotocol/inspector',
]);
const CONTEXT_UNSAFE_PATTERN = new RegExp('[<>&\\u0000-\\u001F]', 'g');

function escapeContextText(content) {
  return content.replace(
    CONTEXT_UNSAFE_PATTERN,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}

function findNearestPackageJson(startDir, projectRoot) {
  for (let directory = startDir; ; directory = path.dirname(directory)) {
    const candidate = path.join(directory, 'package.json');
    if (fs.existsSync(candidate)) return candidate;
    if (directory === projectRoot) return null;
  }
}

function detectMcpProject(cwd, startDir = cwd) {
  const manifestPath = findNearestPackageJson(startDir, cwd);
  if (!manifestPath) return { hasV1: false, v2Packages: [] };
  const packageJson = JSON.parse(fs.readFileSync(manifestPath, 'utf8').trimStart());
  const dependencyNames = Object.keys({
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
    ...packageJson.peerDependencies,
    ...packageJson.optionalDependencies,
  });
  const mcpPackageNames = dependencyNames.filter((name) => name.startsWith(MCP_PACKAGE_PREFIX));
  const hasV1 = mcpPackageNames.includes(V1_PACKAGE);
  const v2Packages = mcpPackageNames.filter(
    (packageName) => packageName !== V1_PACKAGE && !TOOLING_PACKAGES.has(packageName),
  );
  return { hasV1, v2Packages };
}

function isMcpProject(cwd, startDir = cwd) {
  const { hasV1, v2Packages } = detectMcpProject(cwd, startDir);
  return hasV1 || v2Packages.length > 0;
}

module.exports = { detectMcpProject, isMcpProject, escapeContextText };
