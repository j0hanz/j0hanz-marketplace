import IconButton from '@mui/material/IconButton';
import { useColorScheme } from '@mui/material/styles';
import { useEffect } from 'react';
import { DarkModeIcon, LightModeIcon, SettingsBrightnessIcon } from '../icons';
import { ground } from '../theme/tokens';

type Mode = 'system' | 'light' | 'dark';

const modes: { key: Mode; Icon: typeof SettingsBrightnessIcon; desc: string; aria: string }[] = [
  {
    key: 'system',
    Icon: SettingsBrightnessIcon,
    desc: 'Theme follows system',
    aria: 'system theme',
  },
  { key: 'light', Icon: LightModeIcon, desc: 'Light theme', aria: 'light theme' },
  { key: 'dark', Icon: DarkModeIcon, desc: 'Dark theme', aria: 'dark theme' },
];

export function ModeToggle() {
  const { mode, setMode, colorScheme } = useColorScheme();
  const i = modes.findIndex((m) => m.key === mode);
  const current = modes[i < 0 ? 0 : i];
  const next = modes[(i + 1) % modes.length];

  useEffect(() => {
    if (colorScheme)
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', ground[colorScheme]);
  }, [colorScheme]);

  return (
    <IconButton
      color="inherit"
      aria-label={`${current.desc}. Switch to ${next.aria}.`}
      onClick={() => setMode(next.key)}
      sx={{ p: 1.5 }}
    >
      <current.Icon />
    </IconButton>
  );
}
