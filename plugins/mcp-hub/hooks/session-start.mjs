import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectMcpProject, escapeContextText } from './mcp-project.mjs';
import { context, onCopilot } from './client.mjs';

const skillPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'skills',
  'mcp-router',
  'SKILL.md',
);

// Collected, then written once: Copilot reads SessionStart context only as one JSON object.
const out = [];
const line = (text) => out.push(`${text}\n`);

function emitRouter() {
  line('<mcp-hub-router>');
  line(
    'Scope: MCP (Model Context Protocol) TypeScript SDK work ONLY — ignore for everything else.',
  );
  line(
    onCopilot()
      ? 'Skill names below invoke via the skill tool by their bare name (e.g. /mcp-test -> mcp-test).\n'
      : "Skill names below invoke via the Skill tool as 'mcp-hub:<name>' (e.g. /mcp-test -> mcp-hub:mcp-test).\n",
  );

  try {
    const routerContent = fs.readFileSync(skillPath, 'utf8').replace(/^---[\s\S]*?---\r?\n/, '');
    if (routerContent.includes('</mcp-hub-router>') || routerContent.includes('<system-reminder')) {
      console.error('mcp-hub: refusing to inject router content containing reserved sentinels');
    } else {
      out.push(routerContent);
    }
  } catch (error) {
    console.error(`Error reading mcp router skill: ${error.message}`);
  }

  line('\n</mcp-hub-router>');
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
    line('<mcp-hub-probe>');
    line('Scope: auto-detected MCP packages in this project package.json.');
    line(message);
    line('</mcp-hub-probe>');
  } catch {
    // A missing or invalid package.json should not change the router output.
  }
}

emitRouter();
emitProjectProbe();
process.stdout.write(context('SessionStart', out.join(''), { rawSessionStart: true }));
