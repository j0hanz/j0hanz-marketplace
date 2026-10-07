import { expect, test } from 'claude-code/testing';
import {
  chunks,
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
});

test('R14: JSON text without a listed field is unchanged', async () => {
  const text = '{"max_tokens":1000,"tokenizer":"x","note":"token is fine"}';
  expect(redact(text)).toBe(text);
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
