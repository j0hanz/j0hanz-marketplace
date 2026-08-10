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
 * Uppercase letter-spacing. Two roles, two values:
 * - `captionTracking` is the wide gap for a hero caption — a single label that has to read
 *   as a label, not as part of the paragraph it sits beside.
 * - `navTracking` matches MUI's default button tracking (`2 / 70`), so the mobile menu
 *   reads as the nav bar it replaces instead of as a separate list of options.
 */
export const captionTracking = '0.12em';
export const navTracking = '0.02857em';

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

/**
 * `edge` is the control boundary, which is a different job from `divider`. A hairline
 * between two surfaces only has to be seen; the edge of a control is the thing that says
 * a control is *there*, and WCAG 1.4.11 puts that at 3:1. Divider is around 2:1 in both
 * schemes — right for a rule, too faint for a field. It lives in the palette rather than
 * as a hand-rolled custom property so MUI emits `--mui-palette-edge` next to every other
 * colour, which is the form the rest of this file already reads from.
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
    // brown, and the value that glows on graphite is 1.8:1 on paper. So the accent is one
    // hue at two stops, and in both schemes it is a *fill* wearing an ink label rather
    // than ink itself. That is the rule the old palette broke, not the colour.
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
        // The old #333C48 was 1.7:1 against the page and read as no edge at all.
        divider: '#404A59',
        edge: '#626E80',
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
          scrollBehavior: 'smooth',
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
        // One rule for the whole page instead of a guard per component. MUI's own
        // transitions — accordion collapse, menu grow, tooltip fade — are driven from
        // JS and write their timings inline, so they never saw the media query and
        // gating only the hand-written ones left the longest animation on the page
        // (300ms collapse) running regardless.
        //
        // Reduced motion means less movement, not no transitions: killing every
        // duration also took the card's amber edge and the tooltip fade, which carry
        // meaning and move nothing. So the property list narrows and the clock is
        // capped rather than zeroed — colour, opacity and the inset bars still
        // transition; transform, height and inset fall out of the list and snap.
        // The cap is here because MUI writes its transitions inline as a shorthand
        // (Grow: `opacity 225ms, transform 149ms`), and a two-value duration list
        // against a six-value property list cycles into nonsense.
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
      // The ripple is Material's press signal: a round shape spreading out of a square
      // one, on a page with no radius anywhere. `:active` below already answers the
      // press, so the ripple was a second, off-voice answer to the same event.
      defaultProps: { disableRipple: true },
      styleOverrides: {
        root: {
          // ButtonBase clears the outline for its own 8%-alpha tint, which barely registers.
          '&.Mui-focusVisible': focusRing,
          // Presses answer back. Transform only, so it never reflows the row it sits in.
          // Untransitioned: a `transition` here loses to every component's own at the
          // same specificity, and at 1px the curve is invisible anyway.
          '&:active': { transform: 'translateY(1px)' },
        },
      },
    },
    // Link tracks focus-visible itself and answers with the browser's `outline: auto`,
    // which outranks the global rule on specificity. Same fix as ButtonBase above.
    MuiLink: { styleOverrides: { root: { '&.Mui-focusVisible': focusRing } } },
    // Chips default to a 16px pill, which is the one rounded shape on a zero-radius page.
    // They count things, so they stay in the chassis voice rather than the reading one.
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 0, fontFamily: mono },
        // MUI's outlined chip hardcodes grey.600, a third grey next to the two tokens.
        // `edge` and not `divider`: a chip is a bounded object with a box drawn round
        // it, same as a field or a toggle, and two of them are focusable tooltips.
        // `divider` is for rules between surfaces and sank to 1.9:1 inside a card.
        outlined: { borderColor: 'var(--mui-palette-edge)' },
      },
    },
    // The field is a control, so its boundary takes `edge`. Written from the root so
    // it lands at the same specificity as MUI's own rule and after it; hover and focus
    // are two classes deep and keep their own colours.
    MuiOutlinedInput: {
      styleOverrides: {
        root: { '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--mui-palette-edge)' } },
      },
    },
    // The group collapses seams by giving every button after the first a transparent
    // left border and pulling it back 1px onto its neighbour's right border. That works
    // along a row and fails at the end of one: the button that starts the second row has
    // nothing to its left to borrow, so the box sits open. Colouring the border instead
    // of hiding it closes the wrapped row and changes no geometry — the -1px margin still
    // lands it on top of the previous right border, so a seam is one pixel either way.
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
          // Selected was a 16%-alpha wash and nothing else: 1.5:1, the faintest state
          // on the page, worn by the one control that says what the catalog is showing.
          // Ink, weight and an amber bar — the same three the nav uses for "you are
          // here". Bar as an inset shadow, not a border: the group collapses adjacent
          // borders to hairlines and would eat one side of it.
          '&.Mui-selected': {
            color: 'var(--mui-palette-text-primary)',
            fontWeight: 700,
            boxShadow: 'inset 0 -3px 0 0 var(--mui-palette-primary-main)',
          },
        },
      },
    },
    // Collapse animates `height`, which runs layout, paint and composite on every frame
    // of the open — the most expensive animation on the page, on the section with the
    // most content under each row. 300ms is also outside the band for a disclosure.
    // 200ms is in band and cuts a third of the frames.
    // ponytail: height is inherently a layout animation; if it janks on a phone, the fix
    // is a reveal that does not animate height, not a shorter one.
    MuiAccordion: { defaultProps: { slotProps: { transition: { timeout: 200 } } } },
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
