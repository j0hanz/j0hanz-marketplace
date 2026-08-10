// Design tokens. Constants, not theme params: components import these directly, so each
// file states which it needs and the theme stays a palette/typography register.

/** Monospace stack: the chassis voice. Headings, commands, chips, buttons, nav. */
export const mono = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

/** Reading voice for prose. Mono is right for a command and wrong for a paragraph. */
export const sans =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/**
 * Structural steel: the 3px chassis edges. One value could not serve both grounds — #4A5568
 * is 6.6:1 on paper and 2.3:1 on graphite, so the frame the whole page is built from all but
 * vanished in the scheme it opens in. Two stops of one grey, per scheme in the palette; read
 * here as the variable so every chassis edge keeps its one-token spelling.
 */
export const steel = 'var(--mui-palette-steel)';

/**
 * The page ground per scheme. Literal rather than read off the theme because its second
 * consumer is the `theme-color` meta, and a meta tag's content cannot hold a `var()`.
 */
export const ground = { light: '#EDF0F3', dark: '#0E1116' } as const;

/** Pinned: AppBar height (Toolbar default 64 + 3px steel chassis + a little slack). */
export const scrollOffset = 80;

/** Inline command text. Commands wrap rather than clip. */
export const codeSx = { fontFamily: mono, overflowWrap: 'anywhere' } as const;

/** Announced, never seen. `width: 1` in sx means 100%, so these stay strings. */
export const srOnly = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
} as const;

// One heading treatment — uppercase, tracked, mono — sized fluidly so the display line
// never eats a phone's first screen. Mono is already wide, so the display size takes far
// less extra tracking than the section headings do.
export const heading = (min: string, max: string, letterSpacing: string) => ({
  fontFamily: mono,
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing,
  lineHeight: 1.1,
  fontSize: `clamp(${min}, 5vw, ${max})`,
  textWrap: 'balance' as const,
});

/**
 * One focus ring for everything focusable. Amber is 3:1 on graphite and 3.2:1 on paper —
 * too soft to be the only thing marking where the keyboard is, so the ring takes the ink
 * colour per scheme instead (9.3:1 and 16.5:1).
 */
export const focusRing = {
  outline: '2px solid var(--focus-ring)',
  outlineOffset: '2px',
};
