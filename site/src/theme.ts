import { createTheme } from '@mui/material/styles';

/** Monospace stack for command text. */
export const mono = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'class' },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: '#FFB000', contrastText: '#0F1215' },
      },
    },
    dark: {
      palette: {
        primary: { main: '#FFB000', contrastText: '#0F1215' },
        secondary: { main: '#FF6B00' },
        background: { default: '#0F1215', paper: '#1C2127' },
        text: { primary: '#E2E8F0' },
      },
    },
  },
  shape: { borderRadius: 0 },
  typography: {
    fontFamily: "'JetBrains Mono', monospace",
    h2: {
      fontWeight: 'bold',
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          scrollPaddingTop: 80,
          '@media (prefers-reduced-motion: no-preference)': { scrollBehavior: 'smooth' },
        },
        '.industrial-bezel': {
          border: '3px solid #4A5568',
          boxShadow: 'inset 0 0 0 3px #FFB000',
          transition: 'all 0.15s ease-in-out',
          '&:hover': {
            borderColor: '#FF6B00',
            boxShadow: 'inset 0 0 0 3px #FF6B00',
          },
        },
      },
    },
  },
});
