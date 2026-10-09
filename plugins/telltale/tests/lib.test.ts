import { expect, test } from 'claude-code/testing';
import {
  isAbsolute,
  isJson,
  serverTool,
  skillGroup,
  bandRow,
  bar,
  callTable,
  chunks,
  clip,
  ctxDelta,
  detailHeader,
  formatDur,
  formatElapsed,
  logsPath,
  pct,
  permissionNote,
  serverHeading,
  statusLine,
  toolName,
  usageText,
  cut,
  cutArgs,
  estTokens,
  formatTokens,
  labelCalls,
  mcpServer,
  pretty,
  receipt,
  redact,
  show,
  toParts,
  usedInAnswer,
} from '../hooks/lib';

test('R4: mcpServer reads the server out of an MCP tool name', async () => {
  expect(mcpServer('mcp__orders__search')).toBe('orders');
  expect(mcpServer('mcp__plugin_filesystem-mcp_filesystem__list_roots')).toBe(
    'plugin_filesystem-mcp_filesystem',
  );
  expect(mcpServer('Read')).toBe(null);
});

test('R1: tokens are characters / 4 rounded up, printed as k from 1,000', async () => {
  expect(estTokens(8400)).toBe(2100);
  expect(estTokens(3999)).toBe(1000);
  expect(formatTokens(999)).toBe('999');
  expect(formatTokens(1000)).toBe('1.0k');
  expect(formatTokens(2100)).toBe('2.1k');
  expect(formatTokens(2150)).toBe('2.2k');
});

test('R1: receipt with MCP calls and one error', async () => {
  expect(receipt({ mcpCalls: 2, errors: 1, tokens: 2100, skills: [] })).toBe(
    'telltale: 2 MCP calls · 1 error · ~2.1k tok',
  );
});

test('R1: receipt for one call of 3,999 characters', async () => {
  expect(receipt({ mcpCalls: 1, errors: 0, tokens: estTokens(3999), skills: [] })).toBe(
    'telltale: 1 MCP call · ~1.0k tok',
  );
});

test('R1: receipt for a skill expanded twice and nothing else', async () => {
  expect(receipt({ mcpCalls: 0, errors: 0, tokens: 0, skills: ['s', 's'] })).toBe(
    'telltale: skills: s',
  );
});

test('R1: no receipt without MCP calls or skills', async () => {
  expect(receipt({ mcpCalls: 0, errors: 0, tokens: 0, skills: [] })).toBe(null);
});

test('R1: receipt lists skills once each in first-expansion order', async () => {
  expect(receipt({ mcpCalls: 3, errors: 2, tokens: 12, skills: ['b', 'a', 'b'] })).toBe(
    'telltale: 3 MCP calls · 2 errors · ~12 tok · skills: b, a',
  );
});

test('R14: a listed field name has its whole value redacted', async () => {
  expect(redact({ token: 'abc123' })).toEqual({ token: '[redacted]' });
  expect(redact({ Authorization: 'x', nested: { client_secret: 1 } })).toEqual({
    Authorization: '[redacted]',
    nested: { client_secret: '[redacted]' },
  });
});

test('R14: a field that only contains a listed word is unchanged', async () => {
  expect(redact({ max_tokens: 1000 })).toEqual({ max_tokens: 1000 });
});

test('R14: secret patterns in strings are redacted', async () => {
  const gh = 'ghp_' + 'a'.repeat(36);
  expect(redact(`token is ${gh} ok`)).toBe('token is [redacted] ok');
  expect(redact('key sk-ant-' + 'b'.repeat(30))).toBe('key [redacted]');
  expect(redact('id AKIA' + 'ABCDEFGHIJKLMNOP')).toBe('id [redacted]');
  expect(redact('Authorization: Bearer abcdefgh1234')).toBe('Authorization: Bearer [redacted]');
  expect(redact('jwt eyJhbGci.eyJzdWIi.sig_1')).toBe('jwt [redacted]');
});

test('R14: the added token prefixes are redacted', async () => {
  expect(redact('gitlab glpat-' + 'a'.repeat(20))).toBe('gitlab [redacted]');
  expect(redact('stripe sk_live_' + 'b'.repeat(24))).toBe('stripe [redacted]');
  expect(redact('stripe rk_live_' + 'b'.repeat(24))).toBe('stripe [redacted]');
  expect(redact('webhook whsec_' + 'c'.repeat(24))).toBe('webhook [redacted]');
  expect(redact('aws ASIA' + 'ABCDEFGHIJKLMNOP')).toBe('aws [redacted]');
  expect(redact('npm npm_' + 'd'.repeat(30))).toBe('npm [redacted]');
  expect(redact('authorization: bearer abcdefgh1234')).toBe('authorization: bearer [redacted]');
});

test('R14: a listed field inside JSON text has its string value redacted', async () => {
  expect(redact('{"access_token":"abc123","user":"ann"}')).toBe(
    '{"access_token":"[redacted]","user":"ann"}',
  );
  expect(redact('{ "Password" : "p\\"w" , "n": 1 }')).toBe(
    '{ "Password" : "[redacted]" , "n": 1 }',
  );
});

test('R14: a listed field inside escaped JSON text is redacted too', async () => {
  expect(redact('{"body":"{\\"token\\":\\"abc123\\"}"}')).toBe(
    '{"body":"{\\"token\\":\\"[redacted]\\"}"}',
  );
  const nested = JSON.stringify({ body: JSON.stringify({ token: 'ab"cd\\9', n: 1 }) });
  expect(redact(nested)).toBe('{"body":"{\\"token\\":\\"[redacted]\\",\\"n\\":1}"}');
});

test('R14: JSON text without a listed field is unchanged', async () => {
  const text = '{"max_tokens":1000,"tokenizer":"x","note":"token is fine"}';
  expect(redact(text)).toBe(text);
});

test('R14: a listed field in camelCase or with - or _ is redacted', async () => {
  expect(
    redact({ accessToken: 'a', 'refresh-token': 'b', clientSecret: 'c', API_KEY: 'd' }),
  ).toEqual({
    accessToken: '[redacted]',
    'refresh-token': '[redacted]',
    clientSecret: '[redacted]',
    API_KEY: '[redacted]',
  });
  expect(redact('{"accessToken":"a","user":"ann"}')).toBe(
    '{"accessToken":"[redacted]","user":"ann"}',
  );
  expect(redact(JSON.stringify({ body: JSON.stringify({ clientSecret: 'z', n: 1 }) }))).toBe(
    '{"body":"{\\"clientSecret\\":\\"[redacted]\\",\\"n\\":1}"}',
  );
});

test('R14: the added credential field names are redacted', async () => {
  const names = [
    'x-api-key',
    'id_token',
    'authToken',
    'sessionToken',
    'private_key',
    'aws_secret_access_key',
    'Cookie',
    'Set-Cookie',
    'secret_key',
    'passphrase',
  ];
  const input = Object.fromEntries(names.map((name) => [name, 'v']));
  const output = Object.fromEntries(names.map((name) => [name, '[redacted]']));
  expect(redact(input)).toEqual(output);
  expect(redact(JSON.stringify(input))).toBe(JSON.stringify(output));
});

test('R14: secrets inside arrays are redacted, and long array strings are cut', async () => {
  expect(redact({ rows: [{ token: 'abc' }] })).toEqual({ rows: [{ token: '[redacted]' }] });
  const out = cutArgs({ rows: ['a'.repeat(2500)] }) as { rows: string[] };
  expect(out.rows[0]).toBe('a'.repeat(2000) + '…[cut 500 chars]');
});

test('R14: pagination and count fields stay unredacted', async () => {
  const value = { pageToken: 'p1', next_page_token: 'p2', max_tokens: 10, tokenizer: 'x' };
  expect(redact(value)).toEqual(value);
  expect(redact(JSON.stringify(value))).toBe(JSON.stringify(value));
});

test('R14: a value that matches no pattern is unchanged', async () => {
  expect(redact({ q: 'refund', n: 3, ok: true, none: null })).toEqual({
    q: 'refund',
    n: 3,
    ok: true,
    none: null,
  });
});

test('R14: a sk- run that follows a letter is not a key', async () => {
  expect(redact('use-task-abcdefghijklmnopqrstuv')).toBe('use-task-abcdefghijklmnopqrstuv');
  expect(redact('write-task-breakdown-for-sprints')).toBe('write-task-breakdown-for-sprints');
});

test('R14: a private key block is redacted before the 2,000-character cut', async () => {
  const key = '-----BEGIN RSA PRIVATE KEY-----\n' + 'k'.repeat(1500);
  const content =
    'x'.repeat(1899) + '\n' + key + '\n-----END RSA PRIVATE KEY-----\n' + 'y'.repeat(100);
  const out = cutArgs(redact({ content })) as { content: string };
  expect(out.content).toContain('[redacted]');
  expect(out.content).not.toContain('BEGIN');
  expect(out.content).not.toContain('kkkk');
});

test('R24: a long string argument is cut to 2,000 characters with a marker', async () => {
  const out = cutArgs({ content: 'a'.repeat(50000), short: 'b' }) as Record<string, string>;
  expect(out.content).toBe('a'.repeat(2000) + '…[cut 48000 chars]');
  expect(out.short).toBe('b');
  expect(cut('abc', 5)).toBe('abc');
});

const resp = (toolNames: string[], complete = true) => ({ toolNames, complete });

test('R12: retried, other-tool, answered', async () => {
  const responses = { main: [resp(['x']), resp(['x']), resp(['y']), resp([])] };
  const calls = [
    { id: 'c1', tool: 'x', agent: 'main', response: 0 },
    { id: 'c2', tool: 'x', agent: 'main', response: 1 },
    { id: 'c3', tool: 'y', agent: 'main', response: 2 },
  ];
  expect(labelCalls(responses, calls, () => false)).toEqual({
    c1: 'retried',
    c2: 'other-tool',
    c3: 'answered',
  });
});

test('R12: calls from one response share their next response', async () => {
  const responses = { main: [resp(['x', 'y']), resp(['AskUserQuestion'])] };
  const calls = [
    { id: 'a', tool: 'x', agent: 'main', response: 0 },
    { id: 'b', tool: 'y', agent: 'main', response: 0 },
  ];
  expect(labelCalls(responses, calls, () => false)).toEqual({ a: 'asked-user', b: 'asked-user' });
});

test('R12: an interrupted turn labels its last call aborted', async () => {
  const responses = { main: [resp(['x'])] };
  const calls = [{ id: 'x1', tool: 'x', agent: 'main', response: 0 }];
  expect(labelCalls(responses, calls, () => false)).toEqual({ x1: 'aborted' });
});

test('R12: a cut-off response does not count as the next response', async () => {
  const responses = { main: [resp(['x']), resp([], false)] };
  const calls = [{ id: 'x1', tool: 'x', agent: 'main', response: 0 }];
  expect(labelCalls(responses, calls, () => false)).toEqual({ x1: 'aborted' });
});

test('R12: a running subagent with no next response leaves its call pending', async () => {
  const responses = { main: [resp([])], a1: [resp(['z'])] };
  const calls = [{ id: 'z1', tool: 'z', agent: 'a1', response: 0 }];
  expect(labelCalls(responses, calls, (agent) => agent === 'a1')).toEqual({ z1: 'pending' });
});

const used = (toolNames: string[], inTok: number, out: number, serverTools = 0) => ({
  toolNames,
  complete: true,
  usage: { in: inTok, out, serverTools },
});

test('R51: growth after a single-tool response, net of its output', async () => {
  expect(ctxDelta([used(['x'], 1000, 50), used([], 1400, 20)], 0)).toBe(350);
});

test('R51: the next response with usage counts, not a failed one', async () => {
  const list = [
    used(['x'], 1000, 50),
    { toolNames: [], complete: false, usage: null },
    used([], 1600, 9),
  ];
  expect(ctxDelta(list, 0)).toBe(550);
});

test('R51: no figure for parallel calls, server tools, no next usage or negative growth', async () => {
  expect(ctxDelta([used(['x', 'Read'], 1000, 50), used([], 1400, 20)], 0)).toBeUndefined();
  expect(ctxDelta([used(['x'], 1000, 50, 1), used([], 1400, 20)], 0)).toBeUndefined();
  expect(ctxDelta([used(['x'], 1000, 50)], 0)).toBeUndefined();
  expect(ctxDelta([used(['x'], 1000, 50), used([], 600, 20)], 0)).toBeUndefined();
  expect(ctxDelta([used(['x'], 1000, 50), used([], 1400, 20)], null)).toBeUndefined();
});

test('R13: values from the result that the answer names', async () => {
  expect(
    usedInAnswer('refund order_1182 on 2026-10-03, ref ABC-12.', 'Refunded order_1182 (ABC-12).'),
  ).toEqual(['order_1182', 'ABC-12']);
});

test('R13: a word with no digit is never a value', async () => {
  expect(usedInAnswer('refund order', 'refund done')).toEqual([]);
});

test('R13: no answer, or an answer that uses nothing, gives an empty list', async () => {
  expect(usedInAnswer('order_1182', 'nothing here')).toEqual([]);
  expect(usedInAnswer('order_1182', null)).toEqual([]);
});

test('R13: at most 5 values', async () => {
  const result = 'id1001 id1002 id1003 id1004 id1005 id1006';
  expect(usedInAnswer(result, result)).toEqual(['id1001', 'id1002', 'id1003', 'id1004', 'id1005']);
});

test('R15: records are packed into parts, none dropped', async () => {
  const lines = Array.from({ length: 600 }, (_, i) =>
    JSON.stringify({ type: 'call', i, head: 'x'.repeat(4200) }),
  );
  const parts = toParts(lines);
  expect(parts).toHaveLength(3);
  expect(parts.flat()).toHaveLength(600);
  for (const part of parts) expect(part.join('\n').length).toBeLessThanOrEqual(1_000_000);
});

test('R15: a single record over the limit is cut and marked truncated', async () => {
  const line = JSON.stringify({
    type: 'call',
    text: 'z'.repeat(50),
    args: { a: 'q'.repeat(3000) },
  });
  const parts = toParts([line], 1000);
  expect(parts).toHaveLength(1);
  const only = parts[0]![0]!;
  expect(only.length).toBeLessThanOrEqual(1000);
  const record = JSON.parse(only) as { truncated: boolean; args: string };
  expect(record.truncated).toBe(true);
  expect(record.args).toMatch(/^…\[cut \d+ chars\]$/);
});

test('R15: a record of many short strings shrinks to fit, and the loop ends', async () => {
  for (const item of ['text', 'a'.repeat(15), 'b'.repeat(10)]) {
    const line = JSON.stringify({ type: 'call', tool: 'x', blocks: Array(2000).fill(item) });
    const parts = toParts([line], 1000);
    expect(parts).toHaveLength(1);
    expect(parts[0]![0]!.length).toBeLessThanOrEqual(1000);
    expect((JSON.parse(parts[0]![0]!) as { truncated: boolean }).truncated).toBe(true);
  }
});

test('R14: a secret right after a JSON escape is still redacted', async () => {
  const gh = 'ghp_' + 'a'.repeat(36);
  expect(redact(`{"keys":"one\\n${gh}"}`)).toBe('{"keys":"one\\n[redacted]"}');
  expect(redact(`"\\t${gh}"`)).toBe('"\\t[redacted]"');
  const pem = 'x-----BEGIN PRIVATE KEY-----\\nMIIabc\\n-----END PRIVATE KEY-----';
  expect(redact(`{"bundle":"${pem}"}`)).toBe('{"bundle":"x[redacted]"}');
});

test('R11: JSON that indenting would change is shown exactly as read', async () => {
  const text = '{"a":1.50,"a":12345678901234567890,"s":"x\\u0041"}';
  expect(pretty(text)).toBe(text);
  expect(pretty('{"o":{},"l":[1]}')).toBe('{\n  "o": {},\n  "l": [\n    1\n  ]\n}');
});

test('R20: chunks keep leading blank lines and never pass the size', async () => {
  expect(chunks('\n\nabc')).toEqual(['\n\nabc']);
  const text = 'A'.repeat(10_000) + '\n\n' + 'B'.repeat(10_000);
  const parts = chunks(text);
  for (const part of parts) expect(part.length).toBeLessThanOrEqual(10_000);
  expect(parts.join('')).toBe(text);
  expect(chunks('')).toEqual(['']);
});

test('R11: JSON is pretty-printed, other text is left alone', async () => {
  expect(pretty('{"a":1}')).toBe('{\n  "a": 1\n}');
  expect(pretty('plain text')).toBe('plain text');
});

test('R20: two indented fields never pass the 100,000-character serialized tree bound', async () => {
  // 4,990 one-character strings: 19,961 compact, 34,932 indented, 49,905 serialized.
  const dense = JSON.stringify(
    Array.from({ length: 4990 }, (_, i) => String.fromCharCode(97 + (i % 26))),
  );
  const shown = show(pretty(dense), dense, dense.length);
  expect(shown).toBe(dense);
  expect(JSON.stringify(shown).length * 2).toBeLessThanOrEqual(90_000);
  // The existing R20 case (1,500 small objects) still indents.
  const sparse = JSON.stringify(Array.from({ length: 1500 }, (_, i) => ({ i })));
  expect(show(pretty(sparse), sparse, sparse.length)).toBe(pretty(sparse));
  // A field over 20,000 characters still takes the cut path.
  const big = 'w'.repeat(200_000);
  expect(show(pretty(big), big.slice(0, 20_000), big.length)).toContain('180000 chars cut');
});

test('R20: a field that escapes heavily is cut to fit the serialized budget', async () => {
  const ctl = '\u0001'.repeat(20_000);
  const shown = show(ctl, ctl, ctl.length);
  expect(JSON.stringify(shown).length).toBeLessThanOrEqual(45_100);
  expect(shown.endsWith('\n12501 chars cut')).toBe(true);
  const big = '\u0001'.repeat(50_000);
  expect(show(big, big.slice(0, 20_000), big.length).endsWith('\n42501 chars cut')).toBe(true);
});

test('R32: durations print as ms below a second, then seconds to one decimal', async () => {
  expect(formatDur(812)).toBe('812ms');
  expect(formatDur(999)).toBe('999ms');
  expect(formatDur(2100)).toBe('2.1s');
  expect(formatDur(1050)).toBe('1.1s');
});

test('R29: elapsed time prints whole seconds, then minutes and seconds', async () => {
  expect(formatElapsed(3400)).toBe('3s');
  expect(formatElapsed(59_999)).toBe('59s');
  expect(formatElapsed(75_000)).toBe('1m15s');
  expect(formatElapsed(605_000)).toBe('10m05s');
});

test('R48: clip cuts a row to its width with an ellipsis', async () => {
  expect(clip('abcdef', 6)).toBe('abcdef');
  expect(clip('abcdef', 4)).toBe('abc…');
  expect(clip('abcdef', 1)).toBe('…');
});

test('R32: toolName drops the mcp__<server>__ prefix', async () => {
  expect(toolName('mcp__github__search_issues')).toBe('search_issues');
  expect(toolName('mcp__plugin_fs_filesystem__read')).toBe('read');
  expect(toolName('Read')).toBe('Read');
});

test('R26: the status entry from session totals', async () => {
  expect(statusLine({ calls: 7, errors: 1, tokens: 12_600, skills: 0, ctx: 61 })).toBe(
    'telltale · 7 MCP · 1✗ · ~12.6k tok · ctx 61%',
  );
  expect(statusLine({ calls: 3, errors: 0, tokens: 900, skills: 0, ctx: null })).toBe(
    'telltale · 3 MCP · ~900 tok',
  );
  expect(statusLine({ calls: 0, errors: 0, tokens: 0, skills: 1, ctx: 20 })).toBe(
    'telltale · 1 skill · ctx 20%',
  );
  expect(statusLine({ calls: 0, errors: 0, tokens: 0, skills: 2, ctx: null })).toBe(
    'telltale · 2 skills',
  );
  expect(statusLine({ calls: 0, errors: 0, tokens: 0, skills: 0, ctx: 61 })).toBe(undefined);
});

test('R29: the band row, its parts and its drop order', async () => {
  const band = {
    tool: 'db.run_query',
    elapsedMs: 3000,
    more: 0,
    turnCalls: 2,
    turnTokens: 2200,
    turnErrors: 1,
  };
  expect(bandRow(band, 80)).toBe('◐ db.run_query 3s · turn: 2 MCP · ~2.2k tok · 1✗');
  expect(bandRow(band, 30)).toBe('◐ db.run_query 3s');
  expect(bandRow({ ...band, tool: 'a.x', elapsedMs: 9000, more: 1, turnCalls: 0 }, 80)).toBe(
    '◐ a.x 9s +1 running',
  );
  const tight = bandRow({ ...band, tool: 'a_very_long_server.a_very_long_tool_name' }, 20);
  expect(tight).toBe('◐ a_very_long_se… 3s');
});

const row = (
  tool: string,
  server: string | null,
  ms: number,
  tokens: number,
  next: string | null = 'answered',
) => ({ tool, server, ms, tokens, isError: false, next });

test('R32: the Calls table at 80 columns aligns its columns', async () => {
  const table = callTable(
    [row('search_issues', 'github', 812, 1900), row('Read', null, 12, 310)],
    80,
  );
  expect(table.narrow).toBe(false);
  const lines = table.rows.map((r) => r.main + r.mark + r.next);
  expect(lines[0]).toBe('search_issues  github  812ms  ~1.9k  answered');
  expect(lines[1]).toBe('Read           -       12ms   ~310   answered');
  expect(table.header).toBe('TOOL           SERVER  TIME   TOK    NEXT');
});

test('R32: TOOL is capped at 32 and SERVER at 12, each cut with an ellipsis', async () => {
  const table = callTable(
    [row('x'.repeat(40), 'plugin_filesystem-mcp_filesystem', 812, 1900)],
    120,
  );
  expect(table.rows[0]!.main.startsWith(`${'x'.repeat(31)}…  plugin_file…  `)).toBe(true);
});

test('R32: below 50 columns SERVER and NEXT are left out and rows fit', async () => {
  const table = callTable([row('y'.repeat(60), 'github', 812, 1900)], 40);
  expect(table.narrow).toBe(true);
  expect(table.rows[0]!.next).toBe('');
  expect(table.rows[0]!.main).toBe(`${'y'.repeat(25)}…  812ms  ~1.9k`);
  expect(table.header).toBe(`${'TOOL'.padEnd(26)}  TIME   TOK`);
});

test('R32: an errored row carries its mark in the TOK column, and an open label is …', async () => {
  const table = callTable(
    [{ ...row('a', 'db', 5, 10), isError: true }, row('b', 'db', 5, 10, null)],
    80,
  );
  expect(table.rows[0]!.mark).toBe(' ✗');
  expect(table.rows[1]!.next.trim()).toBe('…');
  const at = table.rows.map((r) => (r.main + r.mark + r.next).length - r.next.trim().length);
  expect(at[0]).toBe(at[1]);
});

test('R41: bars fill 20 cells by share of the costliest, rounded half up', async () => {
  expect(bar(11_000, 11_000)).toBe('━'.repeat(20));
  expect(bar(4900, 11_000)).toBe(`${'━'.repeat(9)}${'─'.repeat(11)}`);
  expect(bar(4750, 10_000)).toBe(`${'━'.repeat(10)}${'─'.repeat(10)}`);
  expect(bar(1, 100_000)).toBe(`━${'─'.repeat(19)}`);
  expect(bar(0, 0)).toBe('─'.repeat(20));
});

test('R41: percentages to one decimal, rounded half up', async () => {
  expect(pct(4900, 200_000)).toBe('2.5');
  expect(pct(11_000, 200_000)).toBe('5.5');
  expect(pct(15_900, 200_000)).toBe('8.0');
});

test('R42: server usage reads calls, errors and tokens read, or never called', async () => {
  expect(usageText({ calls: 3, errors: 1, tokens: 2250 })).toBe('3 calls · 1✗ · ~2.3k read');
  expect(usageText({ calls: 1, errors: 0, tokens: 30 })).toBe('1 call · ~30 read');
  expect(usageText(undefined)).toBe('never called');
});

test('R41: the server heading strings of the delta example', async () => {
  const usage = '3 calls · 1✗ · ~2.3k read';
  expect(
    serverHeading({ name: 'github', pad: 6, tokens: 11_000, max: 11_000, window: 200_000, usage }),
  ).toBe(`github  ${'━'.repeat(20)}  11.0k tok · 5.5% · ${usage}`);
  expect(
    serverHeading({
      name: 'db',
      pad: 6,
      tokens: 4900,
      max: 11_000,
      window: 200_000,
      usage: 'never called',
    }),
  ).toBe(`db      ${'━'.repeat(9)}${'─'.repeat(11)}  4.9k tok · 2.5% · never called`);
  expect(
    serverHeading({ name: 'db', pad: 2, tokens: 4900, max: 4900, window: null, usage: 'x' }),
  ).toBe(`db  ${'━'.repeat(20)}  4.9k tok · x`);
});

test('R36: the detail header, with the agent right after the server', async () => {
  const base = { agentId: null, ms: 812, chars: 7600, tokens: 1900, next: 'answered' };
  expect(detailHeader({ ...base, tool: 'search_issues', server: 'github' })).toBe(
    'search_issues · github · 812ms · 7600 chars · ~1.9k tok · answered',
  );
  expect(
    detailHeader({
      tool: 'run_query',
      server: 'db',
      agentId: 'a1b2',
      ms: 2100,
      chars: 120,
      tokens: 30,
      next: 'retried',
    }),
  ).toBe('run_query · db · agent a1b2 · 2.1s · 120 chars · ~30 tok · retried');
  expect(
    detailHeader({
      tool: 'run_query',
      server: 'db',
      agentId: 'a1b2',
      agentName: 'map the db layer (Explore)',
      ms: 2100,
      chars: 120,
      tokens: 30,
      next: 'retried',
    }),
  ).toBe('run_query · db · agent map the db layer (Explo… · 2.1s · 120 chars · ~30 tok · retried');
  expect(
    detailHeader({ ...base, tool: 'Read', server: null, ms: 5, chars: 4, tokens: 1, next: null }),
  ).toBe('Read · 5ms · 4 chars · ~1 tok · …');
});

test('R50: the permission note follows the verdict, and keeps the old caveat when unknown', async () => {
  expect(permissionNote()).toBe('duration includes any permission prompt');
  expect(permissionNote('ask')).toBe(
    'duration includes a permission decision (dialog or classifier)',
  );
  expect(permissionNote('allow')).toBe('no permission dialog or classifier in this time');
  expect(permissionNote('deny')).toBe('no permission dialog or classifier in this time');
});

test('R10: the log folder prints relative to the start directory, with / separators', async () => {
  expect(logsPath('C:\\proj\\.claude\\telltale\\s1', 'C:\\proj')).toBe('.claude/telltale/s1');
  expect(logsPath('/work/.claude/telltale/s1', '/work/')).toBe('.claude/telltale/s1');
  expect(logsPath('D:\\logs\\s1', 'C:\\proj')).toBe('D:/logs/s1');
  // R10: a folder outside the start directory is absolute, `..` resolved.
  expect(logsPath('/work/../out/s1', '/work')).toBe('/out/s1');
  expect(logsPath('/workshop/s1', '/work')).toBe('/workshop/s1');
  // An unknown start directory leaves the folder absolute; a UNC share keeps its `//`.
  expect(logsPath('/work/.claude/telltale/s1', '')).toBe('/work/.claude/telltale/s1');
  expect(logsPath('\\\\nas\\logs\\s1', 'C:\\proj')).toBe('//nas/logs/s1');
});

test('R37: isJson tells JSON text from cut or plain text', async () => {
  expect(isJson('{"a":1}')).toBe(true);
  expect(isJson('[1, 2]')).toBe(true);
  expect(isJson('{"a":')).toBe(false);
  expect(isJson('plain text')).toBe(false);
});

test('R18: skill groups read the plugin, or the source without Settings, or other', async () => {
  expect(skillGroup('plugin', 'p')).toBe('p');
  expect(skillGroup('plugin', undefined)).toBe('other');
  expect(skillGroup('userSettings', undefined)).toBe('user');
  expect(skillGroup(undefined, undefined)).toBe('other');
});

test('R28, R29: serverTool names a call as <server>.<tool>', async () => {
  expect(serverTool('mcp__db__run_query')).toBe('db.run_query');
});

test('R19: isAbsolute knows drive, UNC-style and POSIX roots', async () => {
  expect(isAbsolute('/x')).toBe(true);
  expect(isAbsolute('C:\\x')).toBe(true);
  expect(isAbsolute('C:/x')).toBe(true);
  expect(isAbsolute('.claude/telltale')).toBe(false);
});
