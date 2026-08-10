import DarkModeIcon from '@mui/icons-material/DarkMode';
import GitHubIcon from '@mui/icons-material/GitHub';
import LightModeIcon from '@mui/icons-material/LightMode';
import MenuIcon from '@mui/icons-material/Menu';
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
import { copy } from '../copy';
import { site } from '../site';
import { steel } from '../theme';

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
      { rootMargin: '-80px 0px -60% 0px' },
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

function ModeToggle() {
  const { mode, setMode } = useColorScheme();
  // `mode` is undefined before mount and 'system' by default. Map to the cycle index
  // and rotate. `system` uses the DarkModeIcon by default (it shows the resolved
  // theme's opposite, signalling "click to override").
  const current: Mode = (mode as Mode | undefined) ?? 'system';
  const next: Mode = modeCycle[(modeCycle.indexOf(current) + 1) % modeCycle.length];
  const Icon = next === 'light' ? LightModeIcon : DarkModeIcon;
  const label = `${copy.modeToggle[current]} — ${copy.modeToggle[next]}`;

  return (
    <IconButton color="inherit" aria-label={label} onClick={() => setMode(next)} sx={{ p: 1 }}>
      <Icon />
    </IconButton>
  );
}

const mobileMenuId = 'nav-mobile-menu';

/** Below `sm` the inline buttons disappear; the burger is the only way in. */
function MobileMenu() {
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
        sx={{ display: { xs: 'inline-flex', sm: 'none' }, p: 1 }}
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
            sx={{ fontFamily: 'inherit' }}
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
          sx={{ fontFamily: 'inherit' }}
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
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            {copy.navLinks.map((link) => (
              <Button
                key={link.href}
                href={link.href}
                color="inherit"
                aria-current={active === link.href ? 'page' : undefined}
                sx={{
                  display: { xs: 'none', sm: 'inline-flex' },
                  // The amber underline is the same signal the chassis uses everywhere
                  // else; reserving its height keeps the row from shifting on scroll.
                  borderBottom: '2px solid transparent',
                  ...(active === link.href && {
                    color: 'primary.main',
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
              sx={{ display: { xs: 'none', sm: 'inline-flex' }, p: 1 }}
            >
              <GitHubIcon />
            </IconButton>
            <MobileMenu />
          </Stack>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
