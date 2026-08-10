import IconButton from '@mui/material/IconButton';
import { useColorScheme } from '@mui/material/styles';
import { useEffect } from 'react';
import { ContrastIcon, DarkModeIcon, LightModeIcon } from '../icons';
import { ground } from '../theme/tokens';

type Mode = 'system' | 'light' | 'dark';

// `label` names the mode while it is current, `target` names it as a destination.
const modes: { key: Mode; Icon: typeof ContrastIcon; label: string; target: string }[] = [
  {
    key: 'system',
    Icon: ContrastIcon,
    label: 'Theme follows system',
    target: 'system theme',
  },
  { key: 'light', Icon: LightModeIcon, label: 'Light theme', target: 'light theme' },
  { key: 'dark', Icon: DarkModeIcon, label: 'Dark theme', target: 'dark theme' },
];

export function ModeToggle() {
  const { mode, setMode, colorScheme } = useColorScheme();
  // `mode` is undefined until MUI mounts, so `current` falls back to the first
  // row and `next` reads off it — the first paint never offers the mode showing.
  const current = modes.find((m) => m.key === mode) ?? modes[0];
  const next = modes[(modes.indexOf(current) + 1) % modes.length];

  // index.html ships one meta per scheme so the first paint is right. A manual
  // choice outranks the OS, so both are pinned to whichever scheme resolved —
  // updating only the matching one would leave the other to win after a switch.
  useEffect(() => {
    if (colorScheme)
      document
        .querySelectorAll('meta[name="theme-color"]')
        .forEach((meta) => meta.setAttribute('content', ground[colorScheme]));
  }, [colorScheme]);

  return (
    <IconButton
      color="inherit"
      aria-label={`${current.label}. Switch to ${next.target}.`}
      onClick={() => setMode(next.key)}
    >
      <current.Icon />
    </IconButton>
  );
}
