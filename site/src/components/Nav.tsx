import AppBar from '@mui/material/AppBar';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { useColorScheme } from '@mui/material/styles';
import { useEffect, useState } from 'react';
import {
  DarkModeIcon,
  GitHubIcon,
  LightModeIcon,
  MarkIcon,
  MenuIcon,
  SettingsBrightnessIcon,
} from '../icons';
import { site } from '../site';
import { ground, mono, scrollOffset, steel } from '../theme/tokens';

const navLinks = [
  { label: 'Plugins', href: '#plugins' },
  { label: 'Skills', href: '#skills' },
  { label: 'Install', href: '#install' },
];
const hrefs = navLinks.map((link) => link.href);

function useActiveSection() {
  const [active, setActive] = useState('');

  useEffect(() => {
    const onScreen = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const href = `#${entry.target.id}`;
          if (entry.isIntersecting) onScreen.add(href);
          else onScreen.delete(href);
        }
        setActive(hrefs.find((href) => onScreen.has(href)) ?? '');
      },
      { rootMargin: `-${scrollOffset}px 0px -60% 0px` },
    );

    for (const href of hrefs) {
      const section = document.querySelector(href);
      if (section) observer.observe(section);
    }
    return () => observer.disconnect();
  }, []);

  return active;
}

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

const iconButtonSx = { p: 1.5 };

function useBrowserChromeColor(colorScheme: keyof typeof ground | undefined) {
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (colorScheme) meta?.setAttribute('content', ground[colorScheme]);
  }, [colorScheme]);
}

function ModeToggle() {
  const { mode, setMode, colorScheme } = useColorScheme();
  useBrowserChromeColor(colorScheme);

  const current: Mode = mode ?? 'system';
  const next: Mode = modeCycle[(modeCycle.indexOf(current) + 1) % modeCycle.length];
  const Icon = modeIcons[current];
  const label = `${modeDescription[current]}. ${switchTo[next]}.`;

  return (
    <IconButton color="inherit" aria-label={label} onClick={() => setMode(next)} sx={iconButtonSx}>
      <Icon />
    </IconButton>
  );
}

const mobileMenuId = 'nav-mobile-menu';

const menuItemSx = {
  fontFamily: mono,
  textTransform: 'uppercase',
  letterSpacing: '0.02857em',
};

function MobileMenu({ active }: { active: string }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = Boolean(anchor);
  const close = () => setAnchor(null);

  return (
    <>
      <IconButton
        color="inherit"
        aria-label="Open menu"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? mobileMenuId : undefined}
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{ display: { xs: 'inline-flex', sm: 'none' }, ...iconButtonSx }}
      >
        <MenuIcon />
      </IconButton>
      <Menu
        id={mobileMenuId}
        anchorEl={anchor}
        open={open}
        onClose={close}
        slotProps={{ paper: { sx: { border: `3px solid ${steel}`, borderRadius: 0 } } }}
      >
        {navLinks.map((link) => (
          <MenuItem
            key={link.href}
            component="a"
            href={link.href}
            onClick={close}
            aria-current={active === link.href ? 'page' : undefined}
            sx={{
              ...menuItemSx,
              ...(active === link.href && {
                fontWeight: 700,
                boxShadow: 'inset 3px 0 0 0 var(--mui-palette-primary-main)',
              }),
            }}
          >
            {link.label}
          </MenuItem>
        ))}
        <MenuItem
          component="a"
          href={site.repoUrl}
          target="_blank"
          rel="noreferrer"
          onClick={close}
          sx={menuItemSx}
        >
          GitHub
        </MenuItem>
      </Menu>
    </>
  );
}

export function Nav() {
  const active = useActiveSection();

  return (
    <AppBar
      position="sticky"
      color="default"
      enableColorOnDark
      sx={{
        bgcolor: 'background.paper',
        borderBottom: `3px solid ${steel}`,
        boxShadow: 'inset 0 -3px 0 0 var(--mui-palette-primary-main)',
      }}
    >
      <Container maxWidth="lg">
        <Toolbar disableGutters>
          <Typography
            variant="h6"
            component="a"
            href="#top"
            sx={{
              flexGrow: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              color: 'inherit',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: '1rem',
              letterSpacing: '0.05em',
              py: 1,
            }}
          >
            <MarkIcon sx={{ fontSize: 20 }} />
            {site.name}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            {navLinks.map((link) => (
              <Button
                key={link.href}
                href={link.href}
                color="inherit"
                aria-current={active === link.href ? 'page' : undefined}
                sx={{
                  display: { xs: 'none', sm: 'inline-flex' },
                  minHeight: 44,
                  borderBottom: '2px solid transparent',
                  color: 'text.secondary',
                  ...(active === link.href && {
                    color: 'text.primary',
                    fontWeight: 700,
                    borderBottomColor: 'primary.main',
                  }),
                }}
              >
                {link.label}
              </Button>
            ))}
            <ModeToggle />
            <IconButton
              color="inherit"
              href={site.repoUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub"
              sx={{ display: { xs: 'none', sm: 'inline-flex' }, ...iconButtonSx }}
            >
              <GitHubIcon />
            </IconButton>
            <MobileMenu active={active} />
          </Stack>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
