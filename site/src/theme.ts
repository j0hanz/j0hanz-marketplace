import { createTheme } from '@mui/material/styles';

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
const heading = (min: string, max: string, letterSpacing: string) => ({
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
const focusRing = {
  outline: '2px solid var(--focus-ring)',
  outlineOffset: '2px',
};

// Fixed grain over the whole page. Flat fills read as sterile at this scale; 3.5% of
// fractal noise gives the steel-and-amber chassis some tooth without touching contrast.
// Sized rather than viewport-filling, so it tiles from one small raster instead of
// re-running the filter across the whole screen on every resize.
const grain =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E\")";

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'class' },
  colorSchemes: {
    // Amber at one lightness cannot serve both grounds: the value that survives white is
    // brown, and the value that glows on graphite is 1.8:1 on paper. So the accent is one
    // hue at two stops, and in both schemes it is a *fill* wearing an ink label rather
    // than ink itself. That is the rule the old palette broke, not the colour.
    light: {
      palette: {
        primary: { main: '#D97706', contrastText: '#0E1116' },
        background: { default: '#EDF0F3', paper: '#FFFFFF' },
        text: { primary: '#0E1116', secondary: steel },
        divider: '#C3CBD4',
      },
    },
    dark: {
      palette: {
        primary: { main: '#F5A524', contrastText: '#0E1116' },
        background: { default: '#0E1116', paper: '#171C23' },
        text: { primary: '#E7EBF0', secondary: '#9BA6B4' },
        // Surfaces sit a tenth of a stop apart, so the hairline is what separates them.
        // The old #333C48 was 1.7:1 against the page and read as no edge at all.
        divider: '#404A59',
      },
    },
  },
  shape: { borderRadius: 0 },
  typography: {
    fontFamily: sans,
    h2: heading('1.75rem', '3.25rem', '0.01em'),
    h4: heading('1.25rem', '2rem', '0.06em'),
    h5: { fontFamily: mono },
    h6: { fontFamily: mono },
    button: { fontFamily: mono },
    body1: { textWrap: 'pretty', lineHeight: 1.65 },
    body2: { textWrap: 'pretty', lineHeight: 1.6 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // Ink on paper, amber on graphite. Declared per scheme selector so the ring is
        // resolved in CSS rather than branched in every component that focuses.
        ':root, .light': { '--focus-ring': '#0E1116' },
        '.dark': { '--focus-ring': '#F5A524' },
        html: {
          scrollPaddingTop: scrollOffset,
          '@media (prefers-reduced-motion: no-preference)': { scrollBehavior: 'smooth' },
        },
        body: {
          '&::before': {
            content: '""',
            position: 'fixed',
            inset: 0,
            zIndex: 0,
            pointerEvents: 'none',
            opacity: 0.035,
            backgroundImage: grain,
          },
        },
        ':focus-visible': focusRing,
      },
    },
    MuiButtonBase: {
      styleOverrides: {
        root: {
          // ButtonBase clears the outline for its own 8%-alpha tint, which barely registers.
          '&.Mui-focusVisible': focusRing,
          // Presses answer back. Transform only, so it never reflows the row it sits in.
          '&:active': { transform: 'translateY(1px)' },
          '@media (prefers-reduced-motion: no-preference)': {
            transition: 'transform 120ms ease',
          },
        },
      },
    },
    // Link tracks focus-visible itself and answers with the browser's `outline: auto`,
    // which outranks the global rule on specificity. Same fix as ButtonBase above.
    MuiLink: { styleOverrides: { root: { '&.Mui-focusVisible': focusRing } } },
    // Chips default to a 16px pill, which is the one rounded shape on a zero-radius page.
    // They count things, so they stay in the chassis voice rather than the reading one.
    MuiChip: { styleOverrides: { root: { borderRadius: 0, fontFamily: mono } } },
    // The one widget that defaults to a different chassis — MUI's grey tooltip
    // surface reads as a foreign object against the amber/steel frame. Match it:
    // paper background, primary text, 2px primary border, square corners, no arrow
    // shadow that would imply a non-zero radius elsewhere.
    MuiTooltip: {
      // Delay the first tip so hover-sweeping the catalog doesn't flash them; once one is
      // open, peers show instantly while the cursor scans the row. One decision, not four.
      defaultProps: { enterDelay: 400, enterNextDelay: 0 },
      styleOverrides: {
        tooltip: {
          backgroundColor: 'var(--mui-palette-background-paper)',
          color: 'var(--mui-palette-text-primary)',
          border: '2px solid var(--mui-palette-primary-main)',
          borderRadius: 0,
          fontSize: '0.75rem',
        },
        arrow: { color: 'var(--mui-palette-background-paper)' },
      },
    },
  },
});
