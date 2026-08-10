import { createTheme } from '@mui/material/styles';
import { focusRing, ground, heading, mono, sans, scrollOffset } from './tokens';

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

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'class' },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: '#B45309', contrastText: '#FFFFFF' },
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
    h2: heading('1.75rem', '3.75rem', '0.01em'),
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
        ':root, .light': { '--focus-ring': '#0E1116' },
        '.dark': { '--focus-ring': '#F5A524' },
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
        root: {
          '&.Mui-focusVisible': focusRing,
          '&:active': { transform: 'translateY(1px)' },
        },
      },
    },
    MuiLink: { styleOverrides: { root: { '&.Mui-focusVisible': focusRing } } },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 0, fontFamily: mono },
        outlined: { borderColor: 'var(--mui-palette-edge)' },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--mui-palette-edge)' } },
      },
    },
    MuiToggleButtonGroup: {
      styleOverrides: {
        root: {
          '& .MuiToggleButtonGroup-grouped:not(:first-of-type)': {
            borderLeftColor: 'var(--mui-palette-edge)',
          },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          borderColor: 'var(--mui-palette-edge)',
          '&.Mui-selected': {
            color: 'var(--mui-palette-text-primary)',
            fontWeight: 700,
            boxShadow: 'inset 0 -3px 0 0 var(--mui-palette-primary-main)',
          },
        },
      },
    },
    MuiAccordion: { defaultProps: { slotProps: { transition: { timeout: 200 } } } },
    MuiTooltip: {
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
