// Design tokens. Constants, not theme params: the components import these directly,
// so each file states which it needs and the theme stays a palette/typography register.

/** Monospace stack: the chassis voice. Headings, commands, chips, buttons, nav. */
export const mono = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

/**
 * Reading voice. Mono is right for a command and wrong for a paragraph: plugin summaries
 * and skill descriptions are prose and were the slowest text on the page to scan. The
 * system stack costs no font bytes and renders native on every OS, which matters more on
 * a page whose largest asset is already three weights of JetBrains Mono.
 */
export const sans =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/** Structural steel: the 3px chassis edges. Deliberately the same in both schemes. */
export const steel = '#4A5568';

/** Pinned: AppBar height (Toolbar default 64 + 3px steel chassis + a little slack). */
export const scrollOffset = 80;

/**
 * Uppercase letter-spacing. Two roles, two values:
 * - `captionTracking` is the wide gap for a hero caption — a single label that has to read
 *   as a label, not as part of the paragraph it sits beside.
 * - `navTracking` matches MUI's default button tracking (`2 / 70`), so the mobile menu
 *   reads as the nav bar it replaces instead of as a separate list of options.
 */
export const captionTracking = '0.12em';
export const navTracking = '0.02857em';

/**
 * Inline command text. Commands wrap rather than clip: a command the visitor cannot read in
 * full is worse than one on two lines.
 */
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
// never eats a phone's first screen. Mono is already wide; the display size takes far less
// extra tracking than the section headings do, or it falls apart into loose letters.
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
 * One focus ring for everything focusable. Amber is the brand signal but only clears 3:1
 * against a dark ground; on paper it is 3.2:1 and too soft to be the only thing marking
 * where the keyboard is. So the ring takes the ink colour per scheme instead — 9.3:1 on
 * graphite, 16.5:1 on paper — and amber keeps the states it can actually carry.
 */
export const focusRing = {
  outline: '2px solid var(--focus-ring)',
  outlineOffset: '2px',
};

// Fixed grain over the whole page. Flat fills read as sterile at this scale; 3.5% of
// fractal noise gives the steel-and-amber chassis some tooth without touching contrast.
// Sized rather than viewport-filling, so it tiles from one small raster instead of
// re-running the filter across the whole screen on every resize.
export const grain =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E\")";
