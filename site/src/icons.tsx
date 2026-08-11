import Box from '@mui/material/Box';
import SvgIcon, { type SvgIconProps } from '@mui/material/SvgIcon';
import { srOnly } from './theme/tokens';

/*
 * Drawn to the same system as the rest of the page: a 24 grid, 2-unit strokes,
 * corners at 90 or 45 and nowhere in between. `borderRadius: 0` runs through
 * every surface here, so a rounded icon reads as borrowed from another site.
 *
 * Two exceptions earn their curves. GitHub is someone else's mark. The sun and
 * moon are the theme control, where being recognised outranks being consistent.
 *
 * Colour comes from `currentColor`, so an icon is whatever text it sits in.
 * Amber is spent only where the page already spends it — the mark, and a copy
 * that landed — because it is the palette's signal for live, not a highlight.
 */
const icon = (path: string) =>
  function Icon(props: SvgIconProps) {
    return (
      <SvgIcon {...props}>
        <path d={path} />
      </SvgIcon>
    );
  };

export function MarkIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M0 0H14V4H4V20H20V10H24V24H0Z" />
      <rect x="16" y="0" width="8" height="8" fill="var(--mui-palette-primary-main)" />
    </SvgIcon>
  );
}

// Stroked rather than filled so index.css can draw it on, the same rule idea at
// icon scale. It mounts only when a copy lands, so the draw is the confirmation.
export function CheckIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <path
        data-draw-check
        d="M5 13l4 4L19 7"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.25}
        strokeLinecap="square"
      />
    </SvgIcon>
  );
}

// A frame broken open at the corner the arrow leaves through — the same idea as
// the mark, at the scale of a link.
const OpenInNew = icon(
  'M11 5H3v16h16v-8h-2v6H5V7h6zM14 3h7v7h-2V6.41l-7.29 7.3-1.42-1.42L17.59 5H14z',
);

/**
 * Marks a link that leaves the site, twice over: the glyph for anyone looking,
 * the phrase for anyone listening. SvgIcon is aria-hidden by default and would
 * otherwise hand screen readers a cue their eyes-on counterparts get for free.
 * The icon is sized in em so it tracks whatever it trails, a footer caption or
 * a card heading alike. A caller that sets `aria-label` replaces the phrase
 * along with the link text, so that label has to carry the warning itself.
 */
export function ExternalIcon() {
  return (
    <>
      <Box component="span" sx={srOnly}>
        {' (opens in a new tab)'}
      </Box>
      <OpenInNew sx={{ fontSize: '0.8em', ml: 0.5, verticalAlign: '-0.1em' }} />
    </>
  );
}

export const ArrowDownwardIcon = icon('M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8z');

// Two sheets, square-cornered: the copy button sits on a Paper whose corners are
// square too, and the rounded original showed the difference at 20px.
export const ContentCopyIcon = icon('M14 2H3v13h2V4h9zM8 7h13v15H8zm2 2v11h9V9z');

// Half lit, half not — the palette itself as the glyph. It replaces Material's
// settings_brightness, which few people read as "follow the system".
export const ContrastIcon = icon(
  'M12 2a10 10 0 1 1 0 20 10 10 0 1 1 0-20zm0 2a8 8 0 1 0 0 16 8 8 0 1 0 0-16zM12 4a8 8 0 0 1 0 16z',
);

export const DarkModeIcon = icon(
  'M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1',
);

export const ExpandMoreIcon = icon('M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z');

export const GitHubIcon = icon(
  'M12 1.27a11 11 0 00-3.48 21.46c.55.09.73-.28.73-.55v-1.84c-3.03.64-3.67-1.46-3.67-1.46-.55-1.29-1.28-1.65-1.28-1.65-.92-.65.1-.65.1-.65 1.1 0 1.73 1.1 1.73 1.1.92 1.65 2.57 1.2 3.21.92a2 2 0 01.64-1.47c-2.47-.27-5.04-1.19-5.04-5.5 0-1.1.46-2.1 1.2-2.84a3.76 3.76 0 010-2.93s.91-.28 3.11 1.1c1.8-.49 3.7-.49 5.5 0 2.1-1.38 3.02-1.1 3.02-1.1a3.76 3.76 0 010 2.93c.83.74 1.2 1.74 1.2 2.94 0 4.21-2.57 5.13-5.04 5.4.45.37.82.92.82 2.02v3.03c0 .27.1.64.73.55A11 11 0 0012 1.27',
);

// A square badge rather than the usual disc: it rides inside square Chips, next
// to the square step markers in Install. Outlined so it flags the tooltip
// without outweighing the label beside it.
export const InfoIcon = icon('M2 2h20v20H2zm2 2v16h16V4zm7 2h2v2h-2zm0 4h2v8h-2z');

export const LightModeIcon = icon(
  'M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5M2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1m18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1M11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1m0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1M5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0z',
);

export const MenuIcon = icon('M3 18h18v-2H3zm0-5h18v-2H3zm0-7v2h18V6z');

// The magnifier archetype on a square lens, so it frames the field it sits in
// rather than floating a circle inside a rectangle.
export const SearchIcon = icon('M3 3h14v14H3zm2 2v10h10V5zm11.71 10.29 5 5-1.42 1.42-5-5z');

// Same lens as SearchIcon with a diagonal slash through the handle — the empty
// state of the catalog search. The slash stops short of the glass so the lens
// still reads as the focal point.
export const SearchOffIcon = icon(
  'M3 3h14v14H3zm2 2v10h10V5zm4.59 3L5 7.41 6.41 6 11 10.59 13.59 8 15 9.41 12.41 12 15 14.59 13.59 16 11 13.41 8.41 16 7 14.59 9.59 12zm8.12 7.29 1.42-1.42-3-3-1.42 1.42z',
);

// Two crossed bars: the same weight as the menu but flipped to an X, so the
// mobile menu has a clean close. Sized to match MenuIcon's 18-unit span.
export const CloseIcon = icon(
  'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
);

// A square robot face — the model-loaded chip. Two square eyes and a square
// mouth, antenna as a 2u stroke up. Distinguishes from InfoIcon at a glance.
export const BotIcon = icon(
  'M4 8h16v12H4zm2 2v8h12v-8zm2 2h2v2H8zm6 0h2v2h-2zM7 14h10v2H7zM11 4h2v3h-2z',
);

// The catalog categories share a frame, then differ in a single 4-unit mark
// inside it. Reading them in order: authoring (pen nib = 45° triangle),
// development (chevron pair = code), frontend (bracket = `< >`), learning
// (book spine = center bar), productivity (bolt = two diagonals), quality
// (check = the live tick in miniature, drawn on currentColor, not amber).
export const CategoryIcon = {
  authoring: 'M3 3h18v18H3zm2 2v14h14V5zm10 4-6 6-2-2 6-6zM7 17l4-4 1 1-4 4z',
  development: 'M3 3h18v18H3zm2 2v14h14V5zm2 4 4 3-4 3v-2l2-1-2-1zm5 5h5v2h-5z',
  frontend: 'M3 3h18v18H3zm2 2v14h14V5zM7 7l-2 5 2 5h2L7 12l2-5zm10 0h-2l-2 5 2 5h2l-2-5z',
  learning: 'M3 3h18v18H3zm2 2v14h14V5zm0 0v14m14-14v14M5 6h14M5 18h14',
  productivity: 'M3 3h18v18H3zm2 2v14h14V5zm10 1-7 8h4l-1 5 7-8h-4z',
  quality: 'M3 3h18v18H3zm2 2v14h14V5zm2 5 4 4 8-8-2-2-6 6-2-2z',
} as const;
export type CategoryName = keyof typeof CategoryIcon;
export function CategoryIconFor({ name, ...props }: SvgIconProps & { name: CategoryName }) {
  return (
    <SvgIcon {...props}>
      <path d={CategoryIcon[name]} />
    </SvgIcon>
  );
}
