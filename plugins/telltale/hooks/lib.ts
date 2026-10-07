// Pure helpers for the telltale mod: no `$`, no I/O, so `claude plugin test` checks them
// directly. Requirement IDs (R1 to R25) are indexed in ../README.md, "Requirements index".

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

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

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

const SECRET_FIELDS = new Set([
  'password',
  'passwd',
  'secret',
  'token',
  'api_key',
  'apikey',
  'api-key',
  'authorization',
  'access_token',
  'refresh_token',
  'client_secret',
]);

// R14. A match must not follow a letter, digit, `_` or `-`, unless that letter ends a JSON
// escape (`\n`, `\r`, `\t`): MCP results are often JSON text. A private key block matches anywhere.
const NOT_AFTER = String.raw`(?:(?<![A-Za-z0-9_-])|(?<=\\[nrt]))`;
const PRIVATE_KEY =
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g;
const SECRET_PATTERNS = [
  /sk-ant-[A-Za-z0-9_-]{20,}/,
  /sk-[A-Za-z0-9_-]{20,}/,
  /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}/,
  /github_pat_[A-Za-z0-9_]{22,}/,
  /AKIA[0-9A-Z]{16}/,
  /xox[abpr]-[A-Za-z0-9-]{10,}/,
  /AIza[0-9A-Za-z_-]{35}/,
  /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
].map((pattern) => new RegExp(NOT_AFTER + pattern.source, 'g'));
const BEARER = new RegExp(`${NOT_AFTER}(Bearer )[A-Za-z0-9._~+/=-]{8,}`, 'g');
// R14: a listed field's string value inside JSON text, and inside JSON escaped once more (a JSON
// string holding JSON; an inner escape is an escaped backslash plus one escape unit, so an escaped
// quote inside the value does not end it). ponytail: deeper escaping and non-string values are not
// matched.
const FIELDS = [...SECRET_FIELDS].join('|');
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
        SECRET_FIELDS.has(key.toLowerCase()) ? '[redacted]' : redact(inner),
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

export type Response = { toolNames: string[]; complete: boolean };
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

const values = (text: string): string[] =>
  text
    .split(/[^A-Za-z0-9_.:/-]+/)
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
// plus the rest of the detail view, stay under it; a compact field is at most 20,000 chars.
const INDENTED_BUDGET = 45_000;

/** R20 and R11: what the detail view draws for one field. */
export const show = (indented: string, raw: string, full: number): string =>
  full > 20_000
    ? `${raw.slice(0, 20_000)}\n${full - 20_000} chars cut`
    : JSON.stringify(indented).length <= INDENTED_BUDGET
      ? indented
      : raw;

/** The engine refuses a Text child over 10,000 characters: cut the text into slices. */
export const chunks = (text: string, size = 10_000): string[] =>
  Array.from({ length: Math.max(1, Math.ceil(text.length / size)) }, (_, i) =>
    text.slice(i * size, (i + 1) * size),
  );
