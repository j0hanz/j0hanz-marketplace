import { createTheme } from '@mui/material/styles';

/** Monospace stack for command text, and for the page: one family, no fallback jump. */
export const mono = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

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
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing,
  lineHeight: 1.1,
  fontSize: `clamp(${min}, 6vw, ${max})`,
  textWrap: 'balance' as const,
});

/** One focus ring for everything focusable, buttons and plain anchors alike. */
const focusRing = {
  outline: '2px solid var(--mui-palette-primary-main)',
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
    light: {
      palette: {
        // Amber deepened for light: #FFB000 on white is 1.9:1 and fails as text or icon.
        primary: { main: '#8F5B00', contrastText: '#FFFFFF' },
        background: { default: '#F2F4F6', paper: '#FFFFFF' },
        text: { primary: '#0F1215', secondary: steel },
        divider: '#CBD2DA',
      },
    },
    dark: {
      palette: {
        primary: { main: '#FFB000', contrastText: '#0F1215' },
        background: { default: '#0F1215', paper: '#1C2127' },
        text: { primary: '#E2E8F0' },
        // Default dark divider is 1.4:1 against the page and reads as no edge at all.
        divider: '#333C48',
      },
    },
  },
  shape: { borderRadius: 0 },
  typography: {
    fontFamily: mono,
    h2: heading('2rem', '3.75rem', '0.01em'),
    h4: heading('1.25rem', '2.125rem', '0.06em'),
    body1: { textWrap: 'pretty' },
    body2: { textWrap: 'pretty' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
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
    MuiChip: { styleOverrides: { root: { borderRadius: 0 } } },
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
