import { createTheme } from '@mui/material/styles';
import { edge, focusRing, ground, heading, lit, mono, sans, scrollOffset } from './tokens';

declare module '@mui/material/styles' {
  interface Palette {
    edge: string;
    steel: string;
  }
  interface PaletteOptions {
    edge?: string;
    steel?: string;
  }
}

const paperSteel = '#4A5568';

/**
 * Press feedback. Snappy down, eased back up: the press is the user's, the
 * release is ours. Button, IconButton and ToggleButton each declare their own
 * `transition`, which would drop transform from the list, so the colour
 * properties are restated here rather than left to the defaults.
 */
const press = {
  transition: [
    'transform 160ms var(--ease-out)',
    'background-color 200ms var(--ease-out)',
    'border-color 200ms var(--ease-out)',
    'box-shadow 200ms var(--ease-out)',
    'color 200ms var(--ease-out)',
  ].join(', '),
  '&:active': { transform: 'scale(0.97)', transitionDuration: '60ms' },
};

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'class' },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: '#B45309', contrastText: '#FFFFFF' },
        error: { main: '#B42318', contrastText: '#FFFFFF' },
        background: { default: ground.light, paper: '#FFFFFF' },
        text: { primary: '#0E1116', secondary: paperSteel },
        divider: '#C3CBD4',
        edge: '#7B8593',
        steel: paperSteel,
      },
    },
    dark: {
      palette: {
        primary: { main: '#F5A524', contrastText: '#0E1116' },
        error: { main: '#F97066', contrastText: '#0E1116' },
        background: { default: ground.dark, paper: '#171C23' },
        text: { primary: '#E7EBF0', secondary: '#9BA6B4' },
        divider: '#404A59',
        edge: '#626E80',
        steel: '#68758A',
      },
    },
  },
  shape: { borderRadius: 0 },
  typography: {
    fontFamily: sans,
    h2: heading({ min: '1.75rem', max: '4.25rem', letterSpacing: '0.01em' }),
    h4: heading({ min: '1.25rem', max: '2rem', letterSpacing: '0.06em' }),
    h5: { fontFamily: mono },
    h6: { fontFamily: mono },
    button: { fontFamily: mono },
    body1: { textWrap: 'pretty', lineHeight: 1.65 },
    body2: { textWrap: 'pretty', lineHeight: 1.6 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ':root, .light': { '--focus-ring': 'var(--mui-palette-text-primary)' },
        '.dark': { '--focus-ring': 'var(--mui-palette-primary-main)' },
        html: {
          scrollPaddingTop: scrollOffset,
          scrollBehavior: 'smooth',
        },
        ':focus-visible': focusRing,
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': {
            transitionProperty:
              'opacity, color, background-color, border-color, box-shadow, fill !important',
            transitionDuration: '150ms !important',
            animationDuration: '0.01ms !important',
            animationIterationCount: '1 !important',
            scrollBehavior: 'auto !important',
          },
        },
      },
    },
    MuiButtonBase: {
      defaultProps: { disableRipple: true },
      styleOverrides: {
        root: { '&.Mui-focusVisible': focusRing },
      },
    },
    MuiButton: { styleOverrides: { root: press } },
    MuiIconButton: { styleOverrides: { root: press } },
    MuiLink: { styleOverrides: { root: { '&.Mui-focusVisible': focusRing } } },
    MuiCard: { styleOverrides: { root: { borderColor: edge } } },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 0, fontFamily: mono },
        outlined: { borderColor: edge },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { '& .MuiOutlinedInput-notchedOutline': { borderColor: edge } },
      },
    },
    MuiToggleButtonGroup: {
      styleOverrides: {
        root: { '& .MuiToggleButtonGroup-grouped:not(:first-of-type)': { borderLeftColor: edge } },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          ...press,
          borderColor: edge,
          '&.Mui-selected': {
            color: 'var(--mui-palette-text-primary)',
            fontWeight: 700,
            boxShadow: lit('bottom'),
          },
        },
      },
    },
    MuiAccordion: { defaultProps: { slotProps: { transition: { timeout: 200 } } } },
    MuiTooltip: {
      // describeChild keeps the child's own visible label as its accessible
      // name; without it MUI replaces "2 hooks" with the tooltip text.
      defaultProps: { enterDelay: 400, enterNextDelay: 0, describeChild: true },
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
