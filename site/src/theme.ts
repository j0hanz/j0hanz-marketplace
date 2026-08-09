import { createTheme } from '@mui/material/styles';

/** Monospace stack for command text, and for the page: one family, no fallback jump. */
export const mono = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

/** Structural steel: the 3px chassis edges. Deliberately the same in both schemes. */
export const steel = '#4A5568';

// One heading treatment — uppercase, tracked, mono — sized fluidly so the display line
// never eats a phone's first screen.
const heading = (min: string, max: string) => ({
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  lineHeight: 1.15,
  fontSize: `clamp(${min}, 6vw, ${max})`,
});

/** One focus ring for everything focusable, buttons and plain anchors alike. */
const focusRing = {
  outline: '2px solid var(--mui-palette-primary-main)',
  outlineOffset: '2px',
};

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'class' },
  colorSchemes: {
    light: {
      palette: {
        // Amber deepened for light: #FFB000 on white is 1.9:1 and fails as text or icon.
        primary: { main: '#8F5B00', contrastText: '#FFFFFF' },
        secondary: { main: '#C2410C' },
        background: { default: '#F2F4F6', paper: '#FFFFFF' },
        text: { primary: '#0F1215', secondary: steel },
        divider: '#CBD2DA',
      },
    },
    dark: {
      palette: {
        primary: { main: '#FFB000', contrastText: '#0F1215' },
        secondary: { main: '#FF6B00' },
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
    h2: heading('2rem', '3.75rem'),
    h4: heading('1.25rem', '2.125rem'),
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          scrollPaddingTop: 80,
          '@media (prefers-reduced-motion: no-preference)': { scrollBehavior: 'smooth' },
        },
        ':focus-visible': focusRing,
      },
    },
    // ButtonBase clears the outline for its own 8%-alpha tint, which barely registers.
    MuiButtonBase: { styleOverrides: { root: { '&.Mui-focusVisible': focusRing } } },
  },
});
