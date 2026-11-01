import { createTheme } from '@mui/material/styles';
import {
  activeSx,
  brand,
  edge,
  focusRing,
  ground,
  ink,
  litIdle,
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

const press = {
  transition: [
    'transform 160ms var(--ease-out)',
    'background-color 200ms var(--ease-out)',
    'border-color 200ms var(--ease-out)',
    'box-shadow 200ms var(--ease-out)',
    'color 200ms var(--ease-out)',
  ].join(', '),
  '&:active': { transform: 'scale(0.97)', transitionDuration: '120ms' },
};

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'class' },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: brand.light, contrastText: '#FFFFFF' },
        error: { main: '#B42318', contrastText: '#FFFFFF' },
        background: { default: ground.light, paper: paper.light },
        text: { primary: ink.light, secondary: '#363F4D' },
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
    h2: {
      fontWeight: 700,
      letterSpacing: '-0.03em',
      lineHeight: 1,
      fontSize: 'clamp(1.75rem, 0.5rem + 4.1vw, 4.25rem)',
      textWrap: 'balance',
    },
    h4: {
      fontWeight: 700,
      letterSpacing: '-0.02em',
      lineHeight: 1.1,
      fontSize: 'clamp(1.25rem, 1rem + 1.11vw, 2rem)',
      textWrap: 'balance',
    },
    h6: { fontWeight: 700 },
    button: { textTransform: 'none', fontWeight: 600, fontSize: '1rem' },
    body1: { textWrap: 'pretty', lineHeight: 1.65 },
    body2: { textWrap: 'pretty', lineHeight: 1.6, fontSize: '1rem' },
    caption: { fontSize: '0.875rem' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ':root, .light': { '--focus-ring': 'var(--mui-palette-text-primary)' },
        '.dark': { '--focus-ring': 'var(--mui-palette-primary-main)' },
        html: { scrollPaddingTop: scrollOffset },
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
    MuiButton: { styleOverrides: { root: { ...press, minHeight: 44 } } },
    MuiIconButton: { styleOverrides: { root: press, sizeMedium: { padding: 12 } } },
    MuiLink: {
      styleOverrides: {
        root: { '&.Mui-focusVisible': focusRing },
        button: { minHeight: 44, display: 'inline-flex', alignItems: 'center' },
      },
    },
    MuiCard: { defaultProps: { elevation: 0 } },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          fontSize: '0.875rem',
          backgroundColor: 'var(--mui-palette-background-default)',
          '&:focus-visible': focusRing,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-notchedOutline': { borderColor: edge },
          '& input::-webkit-search-cancel-button': { display: 'none' },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: { '&.Mui-focused': { color: 'var(--mui-palette-text-primary)' } },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          ...press,
          minHeight: 44,
          border: 0,
          backgroundColor: 'var(--mui-palette-background-paper)',
          color: 'var(--mui-palette-text-secondary)',
          boxShadow: litIdle('bottom'),
          '&.Mui-selected': {
            ...activeSx('bottom'),
            backgroundColor: 'var(--mui-palette-background-paper)',
            '&:hover': { backgroundColor: 'var(--mui-palette-action-hover)' },
          },
        },
      },
    },
    MuiAccordion: { defaultProps: { slotProps: { transition: { timeout: 200 } } } },
    MuiTooltip: {
      defaultProps: { enterDelay: 400, enterNextDelay: 0, describeChild: true },
      styleOverrides: {
        tooltip: {
          backgroundColor: 'var(--mui-palette-background-paper)',
          color: 'var(--mui-palette-text-primary)',
          border: '2px solid var(--mui-palette-primary-main)',
          borderRadius: 0,
          fontSize: '0.875rem',
        },
        arrow: { color: 'var(--mui-palette-background-paper)' },
      },
    },
  },
});
