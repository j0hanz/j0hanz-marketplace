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
