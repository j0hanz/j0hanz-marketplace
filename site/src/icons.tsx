import Box from '@mui/material/Box';
import SvgIcon, { type SvgIconProps } from '@mui/material/SvgIcon';
import { srOnly } from './theme/tokens';

export function MarkIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M0 0H14V4H4V20H20V10H24V24H0Z" />
      <rect x="16" y="0" width="8" height="8" fill="var(--mui-palette-primary-main)" />
    </SvgIcon>
  );
}

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

// The icon now lives here, where it has one caller. The aria-label covers the
// meaning; the glyph is purely decorative.
export function ExternalIcon(props: SvgIconProps) {
  return (
    <>
      <Box component="span" sx={srOnly}>
        {' (opens in a new tab)'}
      </Box>
      <SvgIcon {...props} sx={{ fontSize: '0.8em', ml: 0.5, verticalAlign: '-0.1em', ...props.sx }}>
        <path d="M11 5H3v16h16v-8h-2v6H5V7h6zM14 3h7v7h-2V6.41l-7.29 7.3-1.42-1.42L17.59 5H14z" />
      </SvgIcon>
    </>
  );
}

export const ArrowDownwardIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8z" />
  </SvgIcon>
);

export const ContentCopyIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M14 2H3v13h2V4h9zM8 7h13v15H8zm2 2v11h9V9z" />
  </SvgIcon>
);

// The three modes are one frame at three fills — empty, half, solid — because
// the page has no curve anywhere else and a round sun beside a square mark is a
// second icon family. Fill is also the thing being chosen, which a sun is not.
export const ContrastIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M3 3h18v18H3zm2 2v14h14V5zm1 1h6v12H6z" />
  </SvgIcon>
);

export const DarkModeIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M3 3h18v18H3zm2 2v14h14V5zM6 6h12v12H6z" />
  </SvgIcon>
);

export const ExpandMoreIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z" />
  </SvgIcon>
);

export const GitHubIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M12 1.27a11 11 0 00-3.48 21.46c.55.09.73-.28.73-.55v-1.84c-3.03.64-3.67-1.46-3.67-1.46-.55-1.29-1.28-1.65-1.28-1.65-.92-.65.1-.65.1-.65 1.1 0 1.73 1.1 1.73 1.1.92 1.65 2.57 1.2 3.21.92a2 2 0 01.64-1.47c-2.47-.27-5.04-1.19-5.04-5.5 0-1.1.46-2.1 1.2-2.84a3.76 3.76 0 010-2.93s.91-.28 3.11 1.1c1.8-.49 3.7-.49 5.5 0 2.1-1.38 3.02-1.1 3.02-1.1a3.76 3.76 0 010 2.93c.83.74 1.2 1.74 1.2 2.94 0 4.21-2.57 5.13-5.04 5.4.45.37.82.92.82 2.02v3.03c0 .27.1.64.73.55A11 11 0 0012 1.27" />
  </SvgIcon>
);

export const InfoIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M2 2h20v20H2zm2 2v16h16V4zm7 2h2v2h-2zm0 4h2v8h-2z" />
  </SvgIcon>
);

export const LightModeIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M3 3h18v18H3zm2 2v14h14V5z" />
  </SvgIcon>
);

export const MenuIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M3 18h18v-2H3zm0-5h18v-2H3zm0-7v2h18V6z" />
  </SvgIcon>
);

export const SearchIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M3 3h14v14H3zm2 2v10h10V5zm11.71 10.29 5 5-1.42 1.42-5-5z" />
  </SvgIcon>
);

export const CloseIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
  </SvgIcon>
);
