const fs = require('fs');
const path = require('path');

const skillPath = path.join(__dirname, '..', 'skills', 'mcp-router', 'SKILL.md');

console.log('<mcp-hub-router>');
console.log(
  'Scope: MCP (Model Context Protocol) TypeScript SDK work ONLY — ignore for everything else.',
);
console.log(
  "Skill names below invoke via the Skill tool as 'mcp-hub:<name>' (e.g. /mcp-test -> mcp-hub:mcp-test).\n",
);

try {
  if (fs.existsSync(skillPath)) {
    const rawContent = fs.readFileSync(skillPath, 'utf8');

    // Strip YAML frontmatter:
    // It starts with --- and ends with ---
    const cleaned = rawContent.replace(/^---[\s\S]*?---\r?\n/, '');
    if (cleaned.includes('</mcp-hub-router>') || cleaned.includes('<system-reminder')) {
      console.error('mcp-hub: refusing to inject router content containing reserved sentinels');
    } else {
      process.stdout.write(cleaned);
    }
  } else {
    console.error(`Error reading mcp router skill: ${skillPath} not readable`);
  }
} catch (err) {
  console.error(`Error reading mcp router skill: ${err.message}`);
}

console.log('\n</mcp-hub-router>');

try {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  const depNames = Object.keys(
    Object.assign(
      {},
      pkg.dependencies,
      pkg.devDependencies,
      pkg.peerDependencies,
      pkg.optionalDependencies,
    ),
  );
  const tooling = ['@modelcontextprotocol/codemod', '@modelcontextprotocol/inspector'];
  const mcpDeps = depNames.filter((n) => n.startsWith('@modelcontextprotocol/'));
  const v1 = mcpDeps.includes('@modelcontextprotocol/sdk');
  const v2 = mcpDeps.filter((n) => n !== '@modelcontextprotocol/sdk' && !tooling.includes(n));
  if (v1 || v2.length) {
    console.log('<mcp-hub-probe>');
    console.log('Scope: auto-detected MCP packages in this project package.json.');
    if (v1 && v2.length) {
      console.log(
        `Found v1 (@modelcontextprotocol/sdk) and v2 (${v2.join(', ')}). The v1 package is a blocker for v2 work; /mcp migrate is the migration path.`,
      );
    } else if (v1) {
      console.log(
        'Found @modelcontextprotocol/sdk (v1). The v1 single package is a blocker for v2 work; the mcp-migrator agent handles its removal.',
      );
    } else {
      console.log(
        `Found v2 packages (${v2.join(', ')}). /mcp routes MCP work to the matching specialist skill.`,
      );
    }
    console.log('</mcp-hub-probe>');
  }
} catch {
  // No package.json, unreadable, or invalid JSON -> stay silent (fail open).
}
