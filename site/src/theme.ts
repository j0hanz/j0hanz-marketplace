import { createTheme } from '@mui/material/styles';

/** Monospace stack for command text. Not a Material UI token, so it is passed via `sx`. */
export const mono = "'Geist Mono Variable', ui-monospace, SFMono-Regular, Menlo, monospace";

const primary = {
  main: '#d97757',
  // 6.7:1 on the fill; Material UI's own pick would be white at 3.1:1.
  contrastText: '#1b1917',
};

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'class' },
  colorSchemes: {
    light: { palette: { primary } },
    dark: { palette: { primary } },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: "'Geist Variable', ui-sans-serif, system-ui, sans-serif",
  },
  components: {
    MuiCssBaseline: {
      // Anchor targets must clear the sticky AppBar; smooth scroll is opt-in so the
      // reduced-motion default stays instant.
      styleOverrides: {
        html: {
          scrollPaddingTop: 80,
          '@media (prefers-reduced-motion: no-preference)': { scrollBehavior: 'smooth' },
        },
      },
    },
  },
});
