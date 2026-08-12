import { createTheme } from '@mui/material/styles';
import {
  brand,
  edge,
  focusRing,
  ground,
  heading,
  ink,
  lit,
  litIdle,
  mono,
  paper,
  sans,
  scrollOffset,
  steel,
} from './tokens';

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

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E\")";

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
        primary: { main: brand.light, contrastText: '#FFFFFF' },
        error: { main: '#B42318', contrastText: '#FFFFFF' },
        background: { default: ground.light, paper: paper.light },
        text: { primary: ink.light, secondary: steel.light },
        divider: '#C3CBD4',
        edge: '#7B8593',
        steel: steel.light,
      },
    },
    dark: {
      palette: {
        primary: { main: brand.dark, contrastText: '#0E1116' },
        error: { main: '#F97066', contrastText: '#0E1116' },
        background: { default: ground.dark, paper: paper.dark },
        text: { primary: ink.dark, secondary: '#9BA6B4' },
        divider: '#404A59',
        edge: '#626E80',
        steel: steel.dark,
      },
    },
  },
  shape: { borderRadius: 0 },
  // Menu, Tooltip and Accordion would otherwise run MUI's curve — a second
  // vocabulary on a page with one. Easing is emitted as a CSS string, so the
  // token resolves at paint. Leaving is quicker than entering.
  transitions: {
    easing: {
      easeOut: 'var(--ease-out)',
      easeIn: 'var(--ease-out)',
      easeInOut: 'var(--ease-out)',
      sharp: 'var(--ease-out)',
    },
    duration: {
      shortest: 120,
      shorter: 160,
      short: 200,
      standard: 240,
      complex: 300,
      enteringScreen: 200,
      leavingScreen: 160,
    },
  },
  typography: {
    fontFamily: sans,
    h2: heading({
      min: '1.75rem',
      max: '4.25rem',
      slope: '0.5rem + 4.1vw',
      letterSpacing: '0.01em',
    }),
    // A quarter of h2's rate: section titles stay a step below the headline at
    // every width instead of catching it on the way to their own ceiling.
    h4: heading({ min: '1.25rem', max: '2rem', slope: '1rem + 1.11vw', letterSpacing: '0.06em' }),
    h5: { fontFamily: mono },
    h6: { fontFamily: mono },
    button: { fontFamily: mono },
    body1: { textWrap: 'pretty', lineHeight: 1.65 },
    body2: { textWrap: 'pretty', lineHeight: 1.6 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ':root, .light': { '--focus-ring': 'var(--mui-palette-text-primary)', '--grain': 0.028 },
        '.dark': { '--focus-ring': 'var(--mui-palette-primary-main)', '--grain': 0.05 },
        // No smooth scroll: it drags the viewport across every section in
        // between, spending the reveals each was holding for its own arrival.
        html: { scrollPaddingTop: scrollOffset },
        'body::after': {
          content: '""',
          position: 'fixed',
          inset: 0,
          zIndex: 1,
          pointerEvents: 'none',
          opacity: 'var(--grain)',
          backgroundImage: GRAIN,
        },
        '@media print': { 'body::after': { display: 'none' } },
        ':focus-visible': focusRing,
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': {
            transitionProperty:
              'opacity, color, background-color, border-color, box-shadow, fill !important',
            transitionDuration: '150ms !important',
            animationDuration: '0.01ms !important',
            animationIterationCount: '1 !important',
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
    // 12px around a 24px icon clears the 44px touch target. Scoped to the default
    // size: a `root` padding would outrank MUI's own small and large variants.
    MuiIconButton: { styleOverrides: { root: press, sizeMedium: { padding: 12 } } },
    MuiLink: { styleOverrides: { root: { '&.Mui-focusVisible': focusRing } } },
    MuiCard: { styleOverrides: { root: { borderColor: edge } } },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 0, fontFamily: mono, '&:focus-visible': focusRing },
        outlined: { borderColor: edge },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-notchedOutline': { borderColor: edge },
          // The field draws its own clear button, in the page's icon set.
          '& input::-webkit-search-cancel-button': { display: 'none' },
        },
      },
    },
    // Focused, MUI paints the label primary.main. In the light scheme that is
    // #B45309 on #EDF0F3 — 4.4:1, under AA for a 16px label. Amber stays on the
    // notched outline, where 3:1 is the bar it has to clear.
    MuiInputLabel: {
      styleOverrides: {
        root: { '&.Mui-focused': { color: 'var(--mui-palette-text-primary)' } },
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
          // Unset, MUI's own action colour wins: pure white in dark — brighter
          // than the selected row it sits beside — and rgba(0,0,0,.54) in light,
          // 4.4:1 on the ground. Both are outside the palette. Unselected is
          // secondary text; selected is primary, which is the whole hierarchy.
          color: 'var(--mui-palette-text-secondary)',
          // A transparent bar in the resting state, so the selected shadow
          // interpolates instead of snapping. The brand says selected is an
          // inset bar in primary, never a filled background.
          boxShadow: litIdle('bottom'),
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
