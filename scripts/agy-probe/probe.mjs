// Runs inside Antigravity CLI as every hook and both MCP servers of the agy-probe plugin
// (plan 014, Phase 0), and inside Copilot CLI for the hooks-file check. It records what it was
// handed and answers as little as it can: `{}` to every hook, except one SessionStart request
// that shows whether injectSteps reaches the model. phase0.mjs copies it, with lib.mjs, into
// the probe plugin.
//
//   node probe.mjs hook <event> <form> <log>
//   node probe.mjs mcp <form> <log> [extra args, recorded as given]
import { appendFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { envOf, shrink, TOKEN_HEAD, TOKEN_TAIL } from './lib.mjs';

const [mode, ...rest] = process.argv.slice(2);

const baseline = (log) => {
  try {
    return new Set(JSON.parse(readFileSync(join(dirname(log), 'env-baseline.json'), 'utf8')));
  } catch {
    return new Set();
  }
};

const record = (log, entry) => {
  try {
    const line = {
      at: new Date().toISOString(),
      argv: process.argv.slice(2),
      cwd: process.cwd(),
      env: envOf(process.env, baseline(log)),
      ...entry,
    };
    appendFileSync(log, `${JSON.stringify(line)}\n`);
  } catch {
    // A probe that cannot write still answers; the report shows the event as never fired.
  }
};

// A hook that crashes may deny the tool it guards, so every path ends in valid output.
function hook([event, form, log]) {
  let reply = {};
  try {
    const raw = readFileSync(0, 'utf8');
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = raw;
    }
    record(log, {
      kind: 'hook',
      event,
      via: form,
      payload: shrink(payload),
      transcript: payload?.transcriptPath,
    });
    if (event === 'SessionStart' && form === 'absolute') {
      const ask =
        `agy-probe check: in your next reply, write ${TOKEN_HEAD} followed by a hyphen ` +
        `and ${TOKEN_TAIL}, as one word.`;
      reply = { injectSteps: [{ ephemeralMessage: ask }] };
    }
  } catch {
    reply = {};
  }
  process.stdout.write(JSON.stringify(reply));
}

// A minimal stdio MCP server: enough to see how agy launches it, what it declares, whether it
// answers roots/list, and what a tool call carries.
function server([form, log]) {
  record(log, { kind: 'mcp', event: 'start', via: form });
  const send = (message) =>
    process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`);
  let roots = false;
  createInterface({ input: process.stdin }).on('line', (line) => {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    const { id, method, params } = message;
    if (!method) {
      if (id === 'probe-roots') {
        const result = shrink(message.result ?? message.error);
        record(log, { kind: 'mcp', event: 'roots/list result', via: form, result });
      }
      return;
    }
    record(log, { kind: 'mcp', event: method, via: form, params: shrink(params) });
    if (method === 'initialize') {
      roots = Boolean(params?.capabilities?.roots);
      send({
        id,
        result: {
          protocolVersion: params?.protocolVersion ?? '2025-06-18',
          capabilities: { tools: {} },
          serverInfo: { name: 'agy-probe', version: '0.0.0' },
        },
      });
    } else if (method === 'notifications/initialized') {
      if (roots) send({ id: 'probe-roots', method: 'roots/list' });
    } else if (method === 'tools/list') {
      const text = { type: 'object', properties: { text: { type: 'string' } } };
      const description = 'Echoes its text back. Call it only when asked to probe MCP.';
      send({ id, result: { tools: [{ name: 'probe_echo', description, inputSchema: text }] } });
    } else if (method === 'tools/call') {
      const text = `probe ok: ${params?.arguments?.text ?? ''}`;
      send({ id, result: { content: [{ type: 'text', text }] } });
    } else if (method === 'ping') {
      send({ id, result: {} });
    } else if (id !== undefined) {
      send({ id, error: { code: -32601, message: `agy-probe does not handle ${method}` } });
    }
  });
}

if (mode === 'hook') hook(rest);
else if (mode === 'mcp') server(rest);
else process.stdout.write('{}');
