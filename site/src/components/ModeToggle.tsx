import IconButton from '@mui/material/IconButton';
import { useColorScheme } from '@mui/material/styles';
import { useEffect } from 'react';
import { DarkModeIcon, LightModeIcon, SettingsBrightnessIcon } from '../icons';
import { ground } from '../theme/tokens';

type Mode = 'system' | 'light' | 'dark';

// `label` names the mode while it is current, `target` names it as a destination.
const modes: { key: Mode; Icon: typeof SettingsBrightnessIcon; label: string; target: string }[] = [
  {
    key: 'system',
    Icon: SettingsBrightnessIcon,
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

  useEffect(() => {
    if (colorScheme)
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', ground[colorScheme]);
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
