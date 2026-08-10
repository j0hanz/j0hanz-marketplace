import DarkModeIcon from '@mui/icons-material/DarkMode';
import GitHubIcon from '@mui/icons-material/GitHub';
import LightModeIcon from '@mui/icons-material/LightMode';
import MenuIcon from '@mui/icons-material/Menu';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import AppBar from '@mui/material/AppBar';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import type SvgIcon from '@mui/material/SvgIcon';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { useColorScheme } from '@mui/material/styles';
import { useEffect, useState } from 'react';
import { copy } from '../copy';
import { site } from '../site';
import { mono, navTracking, scrollOffset, steel } from '../theme';

const hrefs = copy.navLinks.map((link) => link.href);

/**
 * Which section the visitor is actually in. The nav is the only wayfinding on a page with
 * four screens of content, and without this every link looks equally unvisited.
 */
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
        // Document order, so the topmost visible section wins when two overlap.
        setActive(hrefs.find((href) => onScreen.has(href)) ?? '');
      },
      // Discount the sticky bar at the top and the tail of the viewport, or a section
      // still counts as current long after it has scrolled past the reading position.
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

// Three modes in a cycle: the pre-paint script in index.html stamps 'system' as the
// default; the cycle matches MUI's supported modes without inventing a fourth.
const modeCycle = ['system', 'light', 'dark'] as const;
type Mode = (typeof modeCycle)[number];

// One icon per state, or two of the three render identically and the button stops
// reporting which mode is on. The label names the state and the action either way.
const modeIcons: Record<Mode, typeof SvgIcon> = {
  system: SettingsBrightnessIcon,
  light: LightModeIcon,
  dark: DarkModeIcon,
};

// A 24px icon in MUI's default 8px padding is a 40px target. On a phone the toggle and
// the burger are the only two controls in the bar, so they are the two that most need
// the 44px. Shared by all three icon buttons in the bar.
const iconButtonSx = { p: 1.5 };

function ModeToggle() {
  const { mode, setMode } = useColorScheme();
  // `mode` is undefined before mount and 'system' by default. Map to the cycle index
  // and rotate.
  const current: Mode = mode ?? 'system';
  const next: Mode = modeCycle[(modeCycle.indexOf(current) + 1) % modeCycle.length];
  const Icon = modeIcons[current];
  // Two sentences, not a dash: screen readers skip a dash silently, so the state and the
  // action ran together into one clause.
  const label = `${copy.modeState[current]}. ${copy.modeNext[next]}.`;

  return (
    <IconButton color="inherit" aria-label={label} onClick={() => setMode(next)} sx={iconButtonSx}>
      <Icon />
    </IconButton>
  );
}

const mobileMenuId = 'nav-mobile-menu';

// The mobile menu carries the same three links as the bar above it, so it speaks in the
// same voice. `fontFamily: inherit` resolved to the reading font and put the nav in
// sentence-case sans on exactly the viewport where it is the only nav there is.
const menuItemSx = {
  fontFamily: mono,
  textTransform: 'uppercase',
  letterSpacing: navTracking,
};

/** Below `sm` the inline buttons disappear; the burger is the only way in. */
function MobileMenu({ active }: { active: string }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = Boolean(anchor);
  const close = () => setAnchor(null);

  return (
    <>
      <IconButton
        color="inherit"
        aria-label={copy.menuLabel}
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
        slotProps={{
          paper: {
            sx: { border: `3px solid ${steel}`, borderRadius: 0 },
          },
        }}
      >
        {copy.navLinks.map((link) => (
          <MenuItem
            key={link.href}
            component="a"
            href={link.href}
            onClick={close}
            aria-current={active === link.href ? 'page' : undefined}
            sx={{
              ...menuItemSx,
              // The bar above marks the current section; the menu that replaces it below
              // `sm` marked nothing, on the viewport where the page scrolls longest.
              // Amber bar and weight, same as the nav and the open accordion row.
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
          {copy.githubLabel}
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
              color: 'inherit',
              textDecoration: 'none',
              fontWeight: 700,
              py: 1,
            }}
          >
            {site.name}
          </Typography>
          {/* 8px between targets, not 4: below `sm` this row is two icon buttons and
              nothing else, and they were close enough to catch the wrong one. */}
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            {copy.navLinks.map((link) => (
              <Button
                key={link.href}
                href={link.href}
                color="inherit"
                aria-current={active === link.href ? 'page' : undefined}
                sx={{
                  display: { xs: 'none', sm: 'inline-flex' },
                  // `sm` starts at 600px, which is still a thumb on a tablet.
                  minHeight: 44,
                  // The amber underline is the same signal the chassis uses everywhere
                  // else; reserving its height keeps the row from shifting on scroll.
                  borderBottom: '2px solid transparent',
                  // Weight and ink carry "you are here"; amber only underlines it. As the
                  // link colour amber was 3.2:1 on paper and failed as text outright.
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
              aria-label={copy.githubLabel}
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
