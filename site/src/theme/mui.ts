import { createTheme } from '@mui/material/styles';
import { focusRing, heading, mono, sans, scrollOffset, steel } from './tokens';

/**
 * `edge` is the control boundary, which is a different job from `divider`. WCAG 1.4.11 puts
 * the edge of a control at 3:1; divider is around 2:1 in both schemes — right for a rule,
 * too faint for a field. In the palette rather than a hand-rolled custom property so MUI
 * emits `--mui-palette-edge` next to every other colour.
 */
declare module '@mui/material/styles' {
  interface Palette {
    edge: string;
  }
  interface PaletteOptions {
    edge?: string;
  }
}

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'class' },
  colorSchemes: {
    // Amber at one lightness cannot serve both grounds: the value that survives white is
    // brown, and the value that glows on graphite is 1.8:1 on paper. One hue at two stops,
    // and in both schemes a *fill* wearing an ink label rather than ink itself.
    light: {
      palette: {
        primary: { main: '#D97706', contrastText: '#0E1116' },
        background: { default: '#EDF0F3', paper: '#FFFFFF' },
        text: { primary: '#0E1116', secondary: steel },
        divider: '#C3CBD4',
        edge: '#7B8593',
      },
    },
    dark: {
      palette: {
        primary: { main: '#F5A524', contrastText: '#0E1116' },
        background: { default: '#0E1116', paper: '#171C23' },
        text: { primary: '#E7EBF0', secondary: '#9BA6B4' },
        // Surfaces sit a tenth of a stop apart, so the hairline is what separates them.
        divider: '#404A59',
        edge: '#626E80',
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
        // Ink on paper, amber on graphite. Resolved in CSS rather than branched per component.
        ':root, .light': { '--focus-ring': '#0E1116' },
        '.dark': { '--focus-ring': '#F5A524' },
        html: {
          scrollPaddingTop: scrollOffset,
          scrollBehavior: 'smooth',
        },
        ':focus-visible': focusRing,
        // One rule for the whole page: MUI's own transitions are driven from JS and write
        // their timings inline, so they never saw the media query.
        //
        // Reduced motion means less movement, not no transitions — colour, opacity and the
        // inset bars still transition; transform, height and inset fall out of the list and
        // snap. The duration is capped rather than zeroed because MUI writes shorthands
        // (Grow: `opacity 225ms, transform 149ms`) that would cycle into nonsense.
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
      // A round ripple spreading out of a square control, on a page with no radius
      // anywhere. `:active` below already answers the press.
      defaultProps: { disableRipple: true },
      styleOverrides: {
        root: {
          // ButtonBase clears the outline for its own 8%-alpha tint, which barely registers.
          '&.Mui-focusVisible': focusRing,
          // Transform only, so it never reflows the row. Untransitioned: a `transition`
          // here loses to every component's own at the same specificity.
          '&:active': { transform: 'translateY(1px)' },
        },
      },
    },
    // Link answers focus-visible with the browser's `outline: auto`, which outranks the
    // global rule on specificity. Same fix as ButtonBase above.
    MuiLink: { styleOverrides: { root: { '&.Mui-focusVisible': focusRing } } },
    MuiChip: {
      styleOverrides: {
        // Chips default to a 16px pill, the one rounded shape on a zero-radius page.
        root: { borderRadius: 0, fontFamily: mono },
        // MUI's outlined chip hardcodes grey.600, a third grey next to the two tokens.
        // `edge` and not `divider`: a chip is a bounded object, and `divider` sank to
        // 1.9:1 inside a card.
        outlined: { borderColor: 'var(--mui-palette-edge)' },
      },
    },
    // Written from the root so it lands at the same specificity as MUI's own rule and
    // after it; hover and focus are two classes deep and keep their own colours.
    MuiOutlinedInput: {
      styleOverrides: {
        root: { '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--mui-palette-edge)' } },
      },
    },
    // The group hides every non-first left border and pulls the button back 1px onto its
    // neighbour's. That fails at the end of a row: the button starting the second row has
    // nothing to borrow and sits open. Colouring the border closes it and moves nothing.
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
          // Selected was a 16%-alpha wash at 1.5:1 — the faintest state on the page, worn
          // by the control that says what the catalog is showing. Bar as an inset shadow,
          // not a border: the group collapses adjacent borders and would eat one side.
          '&.Mui-selected': {
            color: 'var(--mui-palette-text-primary)',
            fontWeight: 700,
            boxShadow: 'inset 0 -3px 0 0 var(--mui-palette-primary-main)',
          },
        },
      },
    },
    // Collapse animates `height` — layout, paint and composite every frame — and 300ms is
    // outside the band for a disclosure.
    // ponytail: height is inherently a layout animation; if it janks on a phone, the fix
    // is a reveal that does not animate height, not a shorter one.
    MuiAccordion: { defaultProps: { slotProps: { transition: { timeout: 200 } } } },
    // MUI's grey tooltip surface reads as a foreign object against the amber/steel frame.
    MuiTooltip: {
      // Delay the first tip so hover-sweeping the catalog doesn't flash them; once one is
      // open, peers show instantly while the cursor scans the row.
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
