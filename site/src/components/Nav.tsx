import AppBar from '@mui/material/AppBar';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Fade from '@mui/material/Fade';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { CloseIcon, ExternalIcon, GitHubIcon, MarkIcon, MenuIcon } from '../icons';
import { useActiveSection } from '../hooks/useActiveSection';
import { usePressedKey } from '../hooks/usePressedKey';
import { external, site } from '../site';
import { accent, activeSx, drawable, litIdle, mono, rule } from '../theme/tokens';
import { ModeToggle } from './ModeToggle';

const navLinks = [
  { label: 'Plugins', href: '#plugins' },
  { label: 'Skills', href: '#skills' },
];
const hrefs = navLinks.map((link) => link.href);

const menuItemSx = {
  fontFamily: mono,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.02857em',
};

const mobileMenuId = 'nav-mobile-menu';

function MobileMenu({ active }: { active: string }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const swap = usePressedKey();
  const open = Boolean(anchor);
  const close = () => setAnchor(null);
  const Glyph = open ? CloseIcon : MenuIcon;

  return (
    <>
      <IconButton
        color="inherit"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? mobileMenuId : undefined}
        onClick={(e) => {
          swap.press();
          setAnchor(e.currentTarget);
        }}
        sx={{ display: { xs: 'inline-flex', md: 'none' } }}
      >
        <Glyph data-swap-in={swap.pressed} />
      </IconButton>
      <Menu
        id={mobileMenuId}
        anchorEl={anchor}
        open={open}
        onClose={close}
        // Grow opens from scale(0.75, 0.5625) — a 56% vertical squash, wrong on
        // a page with no rounded corners. Position already ties it to the button.
        slots={{ transition: Fade }}
        slotProps={{ paper: { sx: { border: rule, borderRadius: 0 } } }}
      >
        {navLinks.map((link) => (
          <MenuItem
            key={link.href}
            component="a"
            href={link.href}
            onClick={close}
            aria-current={active === link.href ? 'true' : undefined}
            sx={{ ...menuItemSx, ...(active === link.href && activeSx('left')) }}
          >
            {link.label}
          </MenuItem>
        ))}
        <MenuItem component="a" href={site.repoUrl} {...external} onClick={close} sx={menuItemSx}>
          {/* The one row in this menu that leaves the page. */}
          GitHub
          <ExternalIcon />
        </MenuItem>
      </Menu>
    </>
  );
}

export function Nav() {
  const active = useActiveSection(hrefs);

  return (
    <AppBar
      data-draw-load
      position="sticky"
      color="default"
      enableColorOnDark
      sx={{
        bgcolor: 'background.paper',
        borderBottom: rule,
        boxShadow: 'none',
        ...drawable('bottom', accent), // AppBar's own sticky positioning anchors it
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
              fontSize: { xs: '0.8125rem', sm: '1rem' },
              letterSpacing: { xs: 0, sm: '0.05em' },
              py: 1,
            }}
          >
            <MarkIcon />
            {site.name}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            {/* The section links are the one navigation landmark on the page;
                the theme and repo controls beside them are not part of it. */}
            <Stack
              component="nav"
              aria-label="Sections"
              direction="row"
              spacing={1}
              sx={{ alignItems: 'center' }}
            >
              {navLinks.map((link) => (
                <Button
                  key={link.href}
                  href={link.href}
                  color="inherit"
                  aria-current={active === link.href ? 'true' : undefined}
                  sx={{
                    display: { xs: 'none', md: 'inline-flex' },
                    color: 'text.secondary',
                    // The same bar the category filter and the open row wear:
                    // one width for one meaning, held transparent until lit.
                    boxShadow: litIdle('bottom'),
                    ...(active === link.href && activeSx('bottom')),
                  }}
                >
                  {link.label}
                </Button>
              ))}
            </Stack>
            <ModeToggle />
            <IconButton
              color="inherit"
              href={site.repoUrl}
              {...external}
              aria-label="GitHub (opens in a new tab)"
              sx={{ display: { xs: 'none', md: 'inline-flex' } }}
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
