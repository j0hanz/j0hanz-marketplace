// Runs inside Antigravity CLI as every hook and MCP server of the agy-probe plugin (plan 014,
// Phase 0), and inside Copilot CLI for the hooks-file check. It records what it was handed and
// answers as little as it can: `{}` to every hook, except SessionStart and PreInvocation, which
// each ask the model to write a token (whether those asks reach the model is the open question),
// and PreToolUse, which answers allow when its command says so: an empty answer denies the tool
// in agy, and a denied call is a call whose PostToolUse never fires. phase0.mjs copies it, with
// lib.mjs and the setup shell's variable names (env-baseline.json), into the probe plugin.
//
//   node probe.mjs hook <event> <form> [log] [allow]
//   node probe.mjs mcp <form> [log] [extra args, recorded as given]
import { appendFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { envOf, logTargets, PRE_HEAD, PRE_TAIL, shrink, TOKEN_HEAD, TOKEN_TAIL } from './lib.mjs';

const [mode, ...rest] = process.argv.slice(2);

const baseline = () => {
  try {
    return new Set(
      JSON.parse(readFileSync(join(import.meta.dirname, 'env-baseline.json'), 'utf8')),
    );
  } catch {
    return new Set();
  }
};

// Never throws: a hook that crashes may deny the tool it guards. When no target takes the
// line, stderr says why, for whatever agy shows of a hook's errors.
const record = (log, entry) => {
  const failed = [];
  try {
    const line = {
      at: new Date().toISOString(),
      argv: process.argv.slice(2),
      cwd: process.cwd(),
      env: envOf(process.env, baseline()),
      ...entry,
    };
    for (const path of logTargets(log, process.cwd(), tmpdir())) {
      try {
        appendFileSync(path, `${JSON.stringify({ ...line, wroteTo: path, failed })}\n`);
        return;
      } catch (error) {
        failed.push({ path, error: error.code ?? error.message });
      }
    }
    process.stderr.write(`agy-probe: no log took this line: ${JSON.stringify(failed)}\n`);
  } catch {
    // Nothing left to try; the answer still goes out.
  }
};

// A hook that crashes may deny the tool it guards, so every path ends in valid output.
function hook([event, form, ...rest]) {
  let reply = {};
  try {
    // The relative form carries no log path; `allow` is the only other word a command adds.
    const log = rest.find((arg) => arg !== 'allow');
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
    if (event === 'SessionStart' && form === 'relative') {
      reply = {
        injectSteps: [
          {
            ephemeralMessage:
              `agy-probe check: in your next reply, write ${TOKEN_HEAD} followed by a hyphen ` +
              `and ${TOKEN_TAIL}, as one word.`,
          },
        ],
      };
    }
    // PreInvocation is the channel Phase 2 plans to deliver findings through, so its ask must
    // reach the model too. It fires per model step, so the ask waits for the final summary.
    if (event === 'PreInvocation') {
      reply = {
        injectSteps: [
          {
            ephemeralMessage:
              `agy-probe check: in your final summary, write ${PRE_HEAD} followed by a hyphen ` +
              `and ${PRE_TAIL}, as one word.`,
          },
        ],
      };
    }
    if (event === 'PreToolUse' && rest.includes('allow')) {
      reply = { decision: 'allow' };
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
