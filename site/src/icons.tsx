import SvgIcon, { type SvgIconProps } from '@mui/material/SvgIcon';

// Eight icons did not justify @mui/icons-material: 96M on disk and a full npm install of
// every Material glyph. Paths lifted verbatim from that package (MIT), same 24x24 viewBox.
const icon = (d: string) => (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d={d} />
  </SvgIcon>
);

/**
 * The brand mark: the zero out of `j0hanz`, drawn as the slot a plugin seats into. Square
 * ring at radius 0 — the same law as every other surface here — with one amber module flush
 * to the inner floor. Not built with `icon()` above: the seat is a second fill.
 *
 * Edge-to-edge in the 24 box, so it reads a size larger than a Material glyph at the same
 * `fontSize`. Correct that at the call site rather than padding the geometry.
 */
export const MarkIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M0 0h24v24H0zM4 4v16h16V4z" fillRule="evenodd" />
    <rect x="4" y="14" width="16" height="6" fill="var(--mui-palette-primary-main)" />
  </SvgIcon>
);

export const CheckIcon = icon('M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z');

export const ContentCopyIcon = icon(
  'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2m0 16H8V7h11z',
);

export const DarkModeIcon = icon(
  'M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1',
);

export const ExpandMoreIcon = icon('M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z');

export const GitHubIcon = icon(
  'M12 1.27a11 11 0 00-3.48 21.46c.55.09.73-.28.73-.55v-1.84c-3.03.64-3.67-1.46-3.67-1.46-.55-1.29-1.28-1.65-1.28-1.65-.92-.65.1-.65.1-.65 1.1 0 1.73 1.1 1.73 1.1.92 1.65 2.57 1.2 3.21.92a2 2 0 01.64-1.47c-2.47-.27-5.04-1.19-5.04-5.5 0-1.1.46-2.1 1.2-2.84a3.76 3.76 0 010-2.93s.91-.28 3.11 1.1c1.8-.49 3.7-.49 5.5 0 2.1-1.38 3.02-1.1 3.02-1.1a3.76 3.76 0 010 2.93c.83.74 1.2 1.74 1.2 2.94 0 4.21-2.57 5.13-5.04 5.4.45.37.82.92.82 2.02v3.03c0 .27.1.64.73.55A11 11 0 0012 1.27',
);

export const LightModeIcon = icon(
  'M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5M2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1m18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1M11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1m0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1M5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0z',
);

export const MenuIcon = icon('M3 18h18v-2H3zm0-5h18v-2H3zm0-7v2h18V6z');

export const SettingsBrightnessIcon = icon(
  'M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2m0 16.01H3V4.99h18zM8 16h2.5l1.5 1.5 1.5-1.5H16v-2.5l1.5-1.5-1.5-1.5V8h-2.5L12 6.5 10.5 8H8v2.5L6.5 12 8 13.5zm4-7c1.66 0 3 1.34 3 3s-1.34 3-3 3z',
);
