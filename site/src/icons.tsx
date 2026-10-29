import Box from '@mui/material/Box';
import SvgIcon, { type SvgIconProps } from '@mui/material/SvgIcon';
import { externalLabel } from './site';
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
        {externalLabel('')}
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

// The clients' own marks, in one ink like GitHubIcon, since they label a choice rather than
// advertise. Claude Code's is drawn from rectangles alone, so it is the one mark on the page
// that needs no exception to the no-curves rule. Sources: Simple Icons `claudecode` and
// `githubcopilot` (from Primer's copilot-24, MIT), LobeHub `antigravity` (MIT).
export const ClaudeCodeIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M21 10.5h3v3h-3v3h-1.5v3H18v-3h-1.5v3H15v-3H9v3H7.5v-3H6v3H4.5v-3H3v-3H0v-3h3v-6h18Zm-15 0h1.5v-3H6Zm10.5 0H18v-3h-1.5z" />
  </SvgIcon>
);

export const CopilotIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M23.922 16.997C23.061 18.492 18.063 22.02 12 22.02 5.937 22.02.939 18.492.078 16.997A.641.641 0 0 1 0 16.741v-2.869a.883.883 0 0 1 .053-.22c.372-.935 1.347-2.292 2.605-2.656.167-.429.414-1.055.644-1.517a10.098 10.098 0 0 1-.052-1.086c0-1.331.282-2.499 1.132-3.368.397-.406.89-.717 1.474-.952C7.255 2.937 9.248 1.98 11.978 1.98c2.731 0 4.767.957 6.166 2.093.584.235 1.077.546 1.474.952.85.869 1.132 2.037 1.132 3.368 0 .368-.014.733-.052 1.086.23.462.477 1.088.644 1.517 1.258.364 2.233 1.721 2.605 2.656a.841.841 0 0 1 .053.22v2.869a.641.641 0 0 1-.078.256Zm-11.75-5.992h-.344a4.359 4.359 0 0 1-.355.508c-.77.947-1.918 1.492-3.508 1.492-1.725 0-2.989-.359-3.782-1.259a2.137 2.137 0 0 1-.085-.104L4 11.746v6.585c1.435.779 4.514 2.179 8 2.179 3.486 0 6.565-1.4 8-2.179v-6.585l-.098-.104s-.033.045-.085.104c-.793.9-2.057 1.259-3.782 1.259-1.59 0-2.738-.545-3.508-1.492a4.359 4.359 0 0 1-.355-.508Zm2.328 3.25c.549 0 1 .451 1 1v2c0 .549-.451 1-1 1-.549 0-1-.451-1-1v-2c0-.549.451-1 1-1Zm-5 0c.549 0 1 .451 1 1v2c0 .549-.451 1-1 1-.549 0-1-.451-1-1v-2c0-.549.451-1 1-1Zm3.313-6.185c.136 1.057.403 1.913.878 2.497.442.544 1.134.938 2.344.938 1.573 0 2.292-.337 2.657-.751.384-.435.558-1.15.558-2.361 0-1.14-.243-1.847-.705-2.319-.477-.488-1.319-.862-2.824-1.025-1.487-.161-2.192.138-2.533.529-.269.307-.437.808-.438 1.578v.021c0 .265.021.562.063.893Zm-1.626 0c.042-.331.063-.628.063-.894v-.02c-.001-.77-.169-1.271-.438-1.578-.341-.391-1.046-.69-2.533-.529-1.505.163-2.347.537-2.824 1.025-.462.472-.705 1.179-.705 2.319 0 1.211.175 1.926.558 2.361.365.414 1.084.751 2.657.751 1.21 0 1.902-.394 2.344-.938.475-.584.742-1.44.878-2.497Z" />
  </SvgIcon>
);

export const AntigravityIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M21.751 22.607c1.34 1.005 3.35.335 1.508-1.508C17.73 15.74 18.904 1 12.037 1 5.17 1 6.342 15.74.815 21.1c-2.01 2.009.167 2.511 1.507 1.506 5.192-3.517 4.857-9.714 9.715-9.714 4.857 0 4.522 6.197 9.714 9.715z" />
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

// SearchIcon's frame with an X inside: the search that came back with nothing.
export const NoResultsIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M3 3h14v14H3zm2 2v10h10V5zm4.59 3L5 7.41 6.41 6 11 10.59 13.59 8 15 9.41 12.41 12 15 14.59 13.59 16 11 13.41 8.41 16 7 14.59 9.59 12zm8.12 7.29 1.42-1.42-3-3-1.42 1.42z" />
  </SvgIcon>
);

export const CloseIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
  </SvgIcon>
);
