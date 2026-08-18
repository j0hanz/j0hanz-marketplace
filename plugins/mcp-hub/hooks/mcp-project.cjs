const fs = require('fs');
const path = require('path');

const MCP_PACKAGE_PREFIX = '@modelcontextprotocol/';
const V1_PACKAGE = '@modelcontextprotocol/sdk';
const TOOLING_PACKAGES = new Set([
  '@modelcontextprotocol/codemod',
  '@modelcontextprotocol/inspector',
]);

function detectMcpProject(cwd) {
  const packageJson = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
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

function isMcpProject(cwd) {
  const { hasV1, v2Packages } = detectMcpProject(cwd);
  return hasV1 || v2Packages.length > 0;
}

module.exports = { detectMcpProject, isMcpProject };
