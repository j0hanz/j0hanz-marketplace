import DarkModeIcon from '@mui/icons-material/DarkMode';
import GitHubIcon from '@mui/icons-material/GitHub';
import LightModeIcon from '@mui/icons-material/LightMode';
import AppBar from '@mui/material/AppBar';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
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

function ModeToggle() {
  const { mode, systemMode, setMode } = useColorScheme();
  // `mode` is 'system' until the visitor picks one, and undefined before mount.
  const resolved = mode === 'system' ? systemMode : mode;
  const next = resolved === 'dark' ? 'light' : 'dark';

  return (
    <IconButton color="inherit" aria-label={copy.modeLabel[next]} onClick={() => setMode(next)}>
      {resolved === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
    </IconButton>
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
                aria-current={active === link.href ? 'true' : undefined}
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
            >
              <GitHubIcon />
            </IconButton>
          </Stack>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
