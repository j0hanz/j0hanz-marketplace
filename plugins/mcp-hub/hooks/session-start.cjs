const fs = require('fs');
const path = require('path');
const { detectMcpProject, escapeContextText } = require('./mcp-project.cjs');

const skillPath = path.join(__dirname, '..', 'skills', 'mcp-router', 'SKILL.md');

function emitRouter() {
  console.log('<mcp-hub-router>');
  console.log(
    'Scope: MCP (Model Context Protocol) TypeScript SDK work ONLY — ignore for everything else.',
  );
  console.log(
    "Skill names below invoke via the Skill tool as 'mcp-hub:<name>' (e.g. /mcp-test -> mcp-hub:mcp-test).\n",
  );

  try {
    const routerContent = fs.readFileSync(skillPath, 'utf8').replace(/^---[\s\S]*?---\r?\n/, '');
    if (routerContent.includes('</mcp-hub-router>') || routerContent.includes('<system-reminder')) {
      console.error('mcp-hub: refusing to inject router content containing reserved sentinels');
    } else {
      process.stdout.write(routerContent);
    }
  } catch (error) {
    console.error(`Error reading mcp router skill: ${error.message}`);
  }

  console.log('\n</mcp-hub-router>');
}

function projectProbeMessage({ hasV1, v2Packages }) {
  if (!hasV1 && v2Packages.length === 0) return null;
  const v2Clause = v2Packages.length
    ? ` and v2 (${v2Packages.map(escapeContextText).join(', ')})`
    : '';
  if (hasV1) {
    return `Found v1 (@modelcontextprotocol/sdk)${v2Clause}. The v1 single package is a blocker for v2 work; /mcp migrate is the migration path and the mcp-migrator agent handles its removal.`;
  }
  return `Found v2 packages (${v2Packages.map(escapeContextText).join(', ')}). /mcp routes MCP work to the matching specialist skill.`;
}

function emitProjectProbe() {
  try {
    const message = projectProbeMessage(detectMcpProject(process.cwd()));
    if (!message) return;
    console.log('<mcp-hub-probe>');
    console.log('Scope: auto-detected MCP packages in this project package.json.');
    console.log(message);
    console.log('</mcp-hub-probe>');
  } catch {
    // A missing or invalid package.json should not change the router output.
  }
}

emitRouter();
emitProjectProbe();
