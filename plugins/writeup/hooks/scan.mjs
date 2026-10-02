const rule = (id, label, pattern) => ({ id, label, pattern });

export const RULES = [
  rule(
    7,
    'AI vocabulary',
    /\b(?:additionally|crucial\w*|delv\w*|enduring|enhanc\w*|foster\w*|garner\w*|interplay\w*|intricate\w*|landscape\w*|pivotal\w*|showcas\w*|tapestr\w*|testament\w*|underscor\w*|vibrant\w*)\b/gi,
  ),
  rule(13, 'em dash', /—/g),
  // Case-sensitive; findSlop also requires 3+ capitalized words in the heading text.
  rule(17, 'title case heading', /^#{1,6} (.+)$/),
  rule(18, 'emoji', /\p{Extended_Pictographic}/gu),
  rule(19, 'curly quotes', /[“‘][^“”‘’\n]*[”’]|[“”‘’]/g),
  rule(
    20,
    'chatbot phrase',
    /I hope this helps|let me know if|\bof course!|\bcertainly!|smoking gun/gi,
  ),
  rule(
    23,
    'filler phrase',
    /\bin order to\b|\bdue to the fact that\b|\bit is important to note\b/gi,
  ),
  rule(31, 'fancy word', /\b(?:utiliz\w*|leverag\w*|facilitat\w*|numerous|in the event that)\b/gi),
];

const blank = (s) => s.replace(/[^\r\n]/g, ' ');

// Fenced blocks (unclosed runs to the end) and inline spans become spaces; newlines stay.
export const stripCode = (text) =>
  text.replace(/```[\s\S]*?(?:```|$)/g, blank).replace(/`[^`\r\n]*`/g, blank);

const isTitleCase = (heading) =>
  heading.split(/\s+/).filter((w) => /^[A-Z][a-z]{3,}/.test(w)).length >= 3;

export const findSlop = (text) =>
  stripCode(text)
    .split(/\r?\n/)
    .flatMap((line, i) =>
      RULES.flatMap(({ id, pattern }) => {
        if (id === 17) {
          const m = line.match(pattern);
          return m && isTitleCase(m[1]) ? [{ id, match: m[1], line: i + 1 }] : [];
        }
        return [...line.matchAll(pattern)].map((m) => ({ id, match: m[0], line: i + 1 }));
      }),
    )
    .sort((a, b) => a.line - b.line || a.id - b.id);
