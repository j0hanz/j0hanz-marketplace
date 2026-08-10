import IconButton from '@mui/material/IconButton';
import { useColorScheme } from '@mui/material/styles';
import { useEffect } from 'react';
import { DarkModeIcon, LightModeIcon, SettingsBrightnessIcon } from '../icons';
import { ground } from '../theme/tokens';

const modeCycle = ['system', 'light', 'dark'] as const;
type Mode = (typeof modeCycle)[number];

const modeIcons = {
  system: SettingsBrightnessIcon,
  light: LightModeIcon,
  dark: DarkModeIcon,
};

const modeDescription = {
  system: 'Theme follows system',
  light: 'Light theme',
  dark: 'Dark theme',
};
const switchTo = {
  system: 'Switch to system theme',
  light: 'Switch to light theme',
  dark: 'Switch to dark theme',
};

function useBrowserChromeColor(colorScheme: keyof typeof ground | undefined) {
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (colorScheme) meta?.setAttribute('content', ground[colorScheme]);
  }, [colorScheme]);
}

export function ModeToggle() {
  const { mode, setMode, colorScheme } = useColorScheme();
  useBrowserChromeColor(colorScheme);

  const current: Mode = mode ?? 'system';
  const next: Mode = modeCycle[(modeCycle.indexOf(current) + 1) % modeCycle.length];
  const Icon = modeIcons[current];
  const label = `${modeDescription[current]}. ${switchTo[next]}.`;

  return (
    <IconButton color="inherit" aria-label={label} onClick={() => setMode(next)} sx={{ p: 1.5 }}>
      <Icon />
    </IconButton>
  );
}
