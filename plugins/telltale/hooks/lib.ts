// Pure helpers for the telltale mod: no `$`, no I/O, so `claude plugin test` checks them
// directly. Requirement IDs (R1 to R51) are indexed in ../README.md, "Requirements index".

import type { NextAction } from '../types';

/** The server out of `mcp__<server>__<tool>`, or null for a built-in tool. */
export const mcpServer = (tool: string): string | null => {
  if (!tool.startsWith('mcp__')) return null;
  const end = tool.indexOf('__', 5);
  return end === -1 ? null : tool.slice(5, end);
};

/** R1: estimated tokens of a text, characters / 4 rounded up. */
export const estTokens = (chars: number): number => Math.ceil(chars / 4);

/** R1: an integer below 1,000, otherwise thousands to one decimal with `k`. */
export const formatTokens = (t: number): string =>
  t < 1000 ? String(t) : `${(Math.round(t / 100) / 10).toFixed(1)}k`;

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** R1: the receipt line, or null when the turn used no MCP tool and no skill. */
export const receipt = (turn: {
  mcpCalls: number;
  errors: number;
  tokens: number;
  skills: string[];
}): string | null => {
  const parts: string[] = [];
  if (turn.mcpCalls > 0) parts.push(plural(turn.mcpCalls, 'MCP call'));
  if (turn.errors > 0) parts.push(plural(turn.errors, 'error'));
  if (turn.mcpCalls > 0) parts.push(`~${formatTokens(turn.tokens)} tok`);
  if (turn.skills.length > 0) parts.push(`skills: ${[...new Set(turn.skills)].join(', ')}`);
  return parts.length > 0 ? `telltale: ${parts.join(' · ')}` : null;
};

// R14: written with `_` between words; a key matches ignoring case and with `_`, `-` or nothing
// between its words.
const SECRET_FIELDS = [
  'password',
  'passwd',
  'secret',
  'token',
  'api_key',
  'x_api_key',
  'authorization',
  'access_token',
  'refresh_token',
  'id_token',
  'auth_token',
  'session_token',
  'client_secret',
  'private_key',
  'aws_secret_access_key',
  'cookie',
  'set_cookie',
  'secret_key',
  'passphrase',
];
const squash = (key: string) => key.toLowerCase().replace(/[_-]/g, '');
const SECRET_KEYS = new Set(SECRET_FIELDS.map(squash));

// R14. A match must not follow a letter, digit, `_` or `-`, unless that letter ends a JSON
// escape (`\n`, `\r`, `\t`): MCP results are often JSON text. A private key block matches anywhere.
const NOT_AFTER = String.raw`(?:(?<![\w-])|(?<=\\[nrt]))`;
const PRIVATE_KEY =
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g;
const SECRET_PATTERNS = [
  /sk-ant-[\w-]{20,}/,
  /sk-[\w-]{20,}/,
  /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}/,
  /github_pat_\w{22,}/,
  /(?:AKIA|ASIA)[0-9A-Z]{16}/,
  /xox[abpr]-[A-Za-z0-9-]{10,}/,
  /AIza[\w-]{35}/,
  /eyJ[\w-]+\.eyJ[\w-]+\.[\w-]+/,
  /glpat-[\w-]{20,}/,
  /sk_live_[A-Za-z0-9]{20,}/,
  /rk_live_[A-Za-z0-9]{20,}/,
  /whsec_[A-Za-z0-9]{20,}/,
  /npm_[\w-]{20,}/,
].map((pattern) => new RegExp(NOT_AFTER + pattern.source, 'g'));
const BEARER = new RegExp(`${NOT_AFTER}([Bb]earer )[\\w.~+/=-]{8,}`, 'g');
// R14: a listed field's string value inside JSON text, and inside JSON escaped once more (a JSON
// string holding JSON; an inner escape is an escaped backslash plus one escape unit, so an escaped
// quote inside the value does not end it). ponytail: deeper escaping and non-string values are not
// matched.
const FIELDS = SECRET_FIELDS.map((name) => name.replaceAll('_', '[_-]?')).join('|');
const JSON_FIELD = new RegExp(String.raw`("(?:${FIELDS})"\s*:\s*")(?:[^"\\]|\\.)*(")`, 'gi');
const ESCAPED_FIELD = new RegExp(
  String.raw`(\\"(?:${FIELDS})\\"\s*:\s*\\")(?:\\\\(?:\\.|[^"\\])|\\[^"\\]|[^"\\])*(\\")`,
  'gi',
);

const redactText = (text: string): string =>
  SECRET_PATTERNS.reduce(
    (out, pattern) => out.replace(pattern, '[redacted]'),
    text
      .replace(JSON_FIELD, '$1[redacted]$2')
      .replace(ESCAPED_FIELD, '$1[redacted]$2')
      .replace(PRIVATE_KEY, '[redacted]')
      .replace(BEARER, '$1[redacted]'),
  );

/** R14: a deep copy with secret fields and secret-shaped strings replaced by `[redacted]`. */
export const redact = (value: unknown): unknown => {
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map(redact);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [
        key,
        SECRET_KEYS.has(squash(key)) ? '[redacted]' : redact(inner),
      ]),
    );
  }
  return value;
};

/** R24: `s`, or its first `max` characters and a marker naming how many were cut. */
export const cut = (s: string, max: number): string =>
  s.length <= max ? s : `${s.slice(0, max)}…[cut ${s.length - max} chars]`;

const mapStrings = (value: unknown, fn: (s: string) => string): unknown => {
  if (typeof value === 'string') return fn(value);
  if (Array.isArray(value)) return value.map((inner) => mapStrings(inner, fn));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key, mapStrings(inner, fn)]),
    );
  }
  return value;
};

/** R24: every string inside the (already redacted) arguments cut to 2,000 characters. */
export const cutArgs = (args: unknown): unknown => mapStrings(args, (s) => cut(s, 2000));

export type Response = {
  toolNames: string[];
  complete: boolean;
  model?: string; // R4: the model that answered, else the one the request named
  effort?: string | number; // R4: as the request asked; absent for a model without effort
  /** R51: API-reported input (all three input counts summed) and output, and server tool uses. */
  usage?: { in: number; out: number; serverTools: number } | null;
};
export type LabelCall = { id: string; tool: string; agent: string; response: number | null };

/** R12: each call's next action, read from the next complete response of its agent. */
export const labelCalls = (
  responses: Record<string, Response[]>,
  calls: LabelCall[],
  isRunning: (agent: string) => boolean,
): Record<string, NextAction> => {
  const labels: Record<string, NextAction> = {};
  for (const call of calls) {
    const list = responses[call.agent] ?? [];
    const next =
      call.response === null
        ? undefined
        : list.slice(call.response + 1).find((response) => response.complete);
    labels[call.id] = !next
      ? isRunning(call.agent)
        ? 'pending'
        : 'aborted'
      : next.toolNames.length === 0
        ? 'answered'
        : next.toolNames.includes(call.tool)
          ? 'retried'
          : next.toolNames.includes('AskUserQuestion')
            ? 'asked-user'
            : 'other-tool';
  }
  return labels;
};

/**
 * R51: how much the agent's context grew after response `k`: the next response with usage, its
 * input minus k's input and k's output. Only when k asked for exactly one tool (any tool, built-in
 * included) and no server tool, and the growth is not negative (a compaction ran between them).
 * Clearing old tool results in between shrinks the input without going negative: the figure is
 * then understated, not dropped.
 */
// ponytail: no split for parallel or mixed calls; attribute by chars share if anyone asks.
export const ctxDelta = (list: Response[], k: number | null): number | undefined => {
  const at = k === null ? undefined : list[k];
  if (!at?.usage || at.toolNames.length !== 1 || at.usage.serverTools > 0) return undefined;
  const next = list.slice(k! + 1).find((response) => response.usage)?.usage;
  if (!next) return undefined;
  const delta = next.in - at.usage.in - at.usage.out;
  return delta >= 0 ? delta : undefined;
};

const values = (text: string): string[] =>
  text
    .split(/[^\w.:/-]+/)
    .map((token) => token.replace(/[.:/-]+$/, ''))
    .filter((token) => token.length >= 4 && /\d/.test(token));

/** R13: up to 5 values from the result that the answer names, in result order. */
export const usedInAnswer = (result: string, answer: string | null): string[] => {
  if (answer === null) return [];
  const named = new Set(values(answer));
  return [...new Set(values(result))].filter((value) => named.has(value)).slice(0, 5);
};

/** R15: one record cut until its JSON line fits in `max`, largest field first, each field
 * replaced by a marker. Every pass must shorten the line, or it stops. */
const shrink = (line: string, max: number): string => {
  const record = JSON.parse(line) as Record<string, unknown>;
  record.truncated = true;
  let out = JSON.stringify(record);
  while (out.length > max) {
    const [largest] = Object.keys(record)
      .filter((key) => key !== 'type' && key !== 'truncated')
      .map((key) => ({ key, size: JSON.stringify(record[key]).length }))
      .sort((x, y) => y.size - x.size);
    if (!largest) break;
    record[largest.key] = `…[cut ${largest.size} chars]`;
    const shorter = JSON.stringify(record);
    if (shorter.length >= out.length) break; // no progress: stop rather than spin
    out = shorter;
  }
  return out;
};

// ponytail: 1,000,000 chars is at most 4 MiB even at 4 bytes per char; measure bytes
// (TextEncoder) if part counts ever matter.
/** R15: JSONL lines packed into parts of at most `maxChars`, never dropping a record. */
export const toParts = (lines: string[], maxChars = 1_000_000): string[][] => {
  const parts: string[][] = [];
  let current: string[] = [];
  let size = 0;
  for (const raw of lines) {
    const line = raw.length > maxChars ? shrink(raw, maxChars) : raw;
    const added = line.length + (current.length > 0 ? 1 : 0);
    if (current.length > 0 && size + added > maxChars) {
      parts.push(current);
      current = [];
      size = 0;
    }
    size += line.length + (current.length > 0 ? 1 : 0);
    current.push(line);
  }
  if (current.length > 0) parts.push(current);
  return parts;
};

/** R11: compact JSON indented (lossless, since it round-trips exactly); anything else as read. */
export const pretty = (text: string): string => {
  try {
    const value: unknown = JSON.parse(text);
    return JSON.stringify(value) === text ? JSON.stringify(value, null, 2) : text;
  } catch {
    return text;
  }
};

// The engine unmounts a tree over 100,000 serialized characters. Two fields at 45,000 each,
// plus the rest of the detail view, stay under it; the budget bounds every path, indented,
// as stored, or cut.
const INDENTED_BUDGET = 45_000;

/** The longest prefix of `s` whose JSON string form is at most `budget` characters. */
const fit = (s: string, budget: number): string => {
  if (JSON.stringify(s).length <= budget) return s;
  let lo = 0;
  let hi = s.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (JSON.stringify(s.slice(0, mid)).length <= budget) lo = mid;
    else hi = mid - 1;
  }
  return s.slice(0, lo);
};

/** R20 and R11: what the detail view draws for one field, never over the serialized budget. */
export const show = (indented: string, raw: string, full: number): string => {
  if (full <= 20_000 && JSON.stringify(indented).length <= INDENTED_BUDGET) return indented;
  const shown = fit(raw.slice(0, 20_000), INDENTED_BUDGET);
  return shown.length < full ? `${shown}\n${full - shown.length} chars cut` : shown;
};

/** The engine refuses a Text child over 10,000 characters: cut the text into slices. */
export const chunks = (text: string, size = 10_000): string[] =>
  Array.from({ length: Math.max(1, Math.ceil(text.length / size)) }, (_, i) =>
    text.slice(i * size, (i + 1) * size),
  );

// v0.3 helpers: the display (R26 to R48) and the paths, JSON and naming checks the hooks share
// (R10, R19, R37, delta R18). The IDs are in the README index.

/** R32: the tool name without its `mcp__<server>__` prefix. */
export const toolName = (tool: string): string => {
  const server = mcpServer(tool);
  return server === null ? tool : tool.slice(`mcp__${server}__`.length);
};

/** R32: below 1,000 ms as `812ms`, else seconds to one decimal, rounded half up. */
export const formatDur = (ms: number): string =>
  ms < 1000 ? `${Math.round(ms)}ms` : `${(Math.floor(ms / 100 + 0.5) / 10).toFixed(1)}s`;

/** R29: whole seconds, or `<m>m<ss>s` from a minute. */
export const formatElapsed = (ms: number): string => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`;
};

/** R48: `text` if it fits `width`, else cut to `width` ending with `…`. */
export const clip = (text: string, width: number): string =>
  text.length <= width ? text : `${text.slice(0, Math.max(0, width - 1))}…`;

/** R26: the status entry, or undefined while nothing was called or expanded. */
export const statusLine = (t: {
  calls: number;
  errors: number;
  tokens: number;
  skills: number;
  ctx: number | null;
}): string | undefined => {
  if (t.calls === 0 && t.skills === 0) return undefined;
  const parts = ['telltale'];
  if (t.calls > 0) parts.push(`${t.calls} MCP`);
  if (t.errors > 0) parts.push(`${t.errors}✗`);
  if (t.calls > 0) parts.push(`~${formatTokens(t.tokens)} tok`);
  if (t.skills > 0) parts.push(plural(t.skills, 'skill'));
  if (t.ctx !== null) parts.push(`ctx ${t.ctx}%`);
  return parts.join(' · ');
};

/** R29: the band row; parts 4 then 3 drop to fit, then the call's name is cut. */
export const bandRow = (
  b: {
    tool: string;
    elapsedMs: number;
    more: number;
    turnCalls: number;
    turnTokens: number;
    turnErrors: number;
  },
  width: number,
): string => {
  const elapsed = formatElapsed(b.elapsedMs);
  const more = b.more > 0 ? ` +${b.more} running` : '';
  const turn =
    b.turnCalls > 0 ? ` · turn: ${b.turnCalls} MCP · ~${formatTokens(b.turnTokens)} tok` : '';
  const errors = b.turnCalls > 0 && b.turnErrors > 0 ? ` · ${b.turnErrors}✗` : '';
  const head = (name: string) => `◐ ${name} ${elapsed}${more}`;
  for (const row of [head(b.tool) + turn + errors, head(b.tool) + turn, head(b.tool)]) {
    if (row.length <= width) return row;
  }
  const room = width - head('').length;
  return clip(head(clip(b.tool, Math.max(1, room))), width);
};

export type TableRow = {
  tool: string; // as drawn: prefix removed, `↳ ` for a subagent's call
  server: string | null;
  ms: number;
  tokens: number;
  isError: boolean;
  next: string | null; // the R12 label, null until the turn ends
};
export type Table = {
  header: string;
  narrow: boolean;
  // `main` holds TOOL, SERVER, TIME and `~<tok>`; `mark` is ` ✗` or ''; `next` is the
  // spacing up to the NEXT column and its label ('' when narrow).
  rows: { main: string; mark: string; next: string }[];
};

/** R32 (amended): columns two spaces apart, SERVER at most 12, TOOL 4 to 32 and what is left. */
export const callTable = (rows: TableRow[], width: number): Table => {
  const narrow = width < 50;
  const cells = rows.map((r) => ({
    tool: r.tool,
    server: clip(r.server ?? '-', 12),
    time: formatDur(r.ms),
    tok: `~${formatTokens(r.tokens)}`,
    mark: r.isError ? ' ✗' : '',
    next: r.next ?? '…',
  }));
  const widest = (header: string, values: string[]) =>
    Math.max(header.length, ...values.map((v) => v.length));
  const serverW = widest(
    'SERVER',
    cells.map((c) => c.server),
  );
  const timeW = widest(
    'TIME',
    cells.map((c) => c.time),
  );
  const tokW = widest(
    'TOK',
    cells.map((c) => c.tok + c.mark),
  );
  const nextW = widest(
    'NEXT',
    cells.map((c) => c.next),
  );
  const others = narrow ? timeW + tokW + 4 : serverW + timeW + tokW + nextW + 8;
  const toolW = Math.max(
    4,
    Math.min(
      32,
      widest(
        'TOOL',
        cells.map((c) => c.tool),
      ),
      width - others,
    ),
  );
  const pad = (s: string, w: number) => clip(s, w).padEnd(w);
  const lead = (tool: string, server: string, time: string) =>
    narrow
      ? `${pad(tool, toolW)}  ${pad(time, timeW)}  `
      : `${pad(tool, toolW)}  ${pad(server, serverW)}  ${pad(time, timeW)}  `;
  return {
    narrow,
    header: narrow
      ? `${lead('TOOL', '', 'TIME')}TOK`
      : `${lead('TOOL', 'SERVER', 'TIME')}${pad('TOK', tokW)}  NEXT`,
    rows: cells.map((c) => ({
      main: lead(c.tool, c.server, c.time) + c.tok,
      mark: c.mark,
      next: narrow ? '' : `${' '.repeat(tokW - c.tok.length - c.mark.length + 2)}${c.next}`,
    })),
  };
};

/** R41: 20 cells, filled by share of the costliest, rounded half up; at least 1 above zero. */
export const bar = (tokens: number, max: number): string => {
  const filled =
    max <= 0
      ? 0
      : Math.min(20, Math.max(tokens > 0 ? 1 : 0, Math.floor((20 * tokens) / max + 0.5)));
  return '━'.repeat(filled) + '─'.repeat(20 - filled);
};

/** R41: `part` over `whole` as a percentage to one decimal, rounded half up. */
export const pct = (part: number, whole: number): string =>
  (Math.floor((part * 1000) / whole + 0.5) / 10).toFixed(1);

/** R42: a server's share of the session totals, or `never called`. */
export const usageText = (
  u: { calls: number; errors: number; tokens: number } | undefined,
): string => {
  if (!u || u.calls === 0) return 'never called';
  const parts = [plural(u.calls, 'call')];
  if (u.errors > 0) parts.push(`${u.errors}✗`);
  parts.push(`~${formatTokens(u.tokens)} read`);
  return parts.join(' · ');
};

/** R41 (amended): `<server>  <bar>  <tok> tok · <p>% · <usage>`. */
export const serverHeading = (h: {
  name: string;
  pad: number;
  tokens: number;
  max: number;
  window: number | null;
  usage: string;
}): string =>
  `${h.name.padEnd(h.pad)}  ${bar(h.tokens, h.max)}  ${formatTokens(h.tokens)} tok` +
  `${h.window ? ` · ${pct(h.tokens, h.window)}%` : ''} · ${h.usage}`;

/** R36 (amended): `<tool> · <server> · agent <name or id> · <dur> · <c> chars · ~<tok> tok · <next>`. */
export const detailHeader = (c: {
  tool: string;
  server: string | null;
  agentId: string | null;
  agentName?: string; // `<task> (<type>)` from the agent list, when telltale saw it listed
  ms: number;
  chars: number;
  tokens: number;
  next: string | null;
}): string =>
  [
    c.tool,
    ...(c.server ? [c.server] : []),
    // R48: the name is capped so the figures after it survive the row clip.
    ...(c.agentId ? [`agent ${c.agentName ? clip(c.agentName, 24) : c.agentId}`] : []),
    formatDur(c.ms),
    `${c.chars} chars`,
    `~${formatTokens(c.tokens)} tok`,
    c.next ?? '…',
  ].join(' · ');

/** R50: the detail's line on what a call's duration includes, by its permission verdict. */
export const permissionNote = (decision?: 'allow' | 'ask' | 'deny'): string => {
  if (decision === undefined) return 'duration includes any permission prompt';
  return decision === 'ask'
    ? 'duration includes a permission decision (dialog or classifier)'
    : 'no permission dialog or classifier in this time';
};

/** R19: a path that starts at a drive or a root, not at the session's directory. */
export const isAbsolute = (path: string) => /^(?:[A-Z]:)?[\\/]/i.test(path);

/** `path` with `/` separators and its `.` and `..` segments resolved. */
const normalize = (path: string): string => {
  const slashed = path.replaceAll('\\', '/');
  const parts: string[] = [];
  for (const part of slashed.split('/')) {
    if (part === '..' && parts.length > 1) parts.pop();
    else if (part !== '.' && (part !== '' || parts.length === 0)) parts.push(part);
  }
  // A UNC share (`\\host\share`) keeps both of its leading separators.
  return (slashed.startsWith('//') ? '/' : '') + parts.join('/');
};

/** R10 (amended): the log folder relative to the start directory when under it, else absolute. */
export const logsPath = (folder: string, startDir: string): string => {
  const path = normalize(folder);
  const base = normalize(startDir).replace(/\/+$/, '');
  if (base === '') return path; // an unknown start directory: no prefix to strip
  return path.startsWith(`${base}/`) ? path.slice(base.length + 1) : path;
};

/** R37: whether `text` parses as JSON. */
export const isJson = (text: string): boolean => {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
};

/** delta R18: a skill's group: its plugin, else its source without `Settings`, else `other`. */
export const skillGroup = (source?: string, plugin?: string): string =>
  source === 'plugin' ? (plugin ?? 'other') : source ? source.replace(/Settings$/, '') : 'other';

/** R28, R29: a call named as `<server>.<tool>`. */
export const serverTool = (tool: string): string => `${mcpServer(tool)}.${toolName(tool)}`;
