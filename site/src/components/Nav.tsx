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
import { copy } from '../copy';
import { site } from '../site';

function ModeToggle() {
  const { mode, systemMode, setMode } = useColorScheme();
  // `mode` is 'system' until the visitor picks one, and undefined before mount.
  const resolved = mode === 'system' ? systemMode : mode;

  return (
    <IconButton
      color="inherit"
      aria-label={copy.modeLabel}
      onClick={() => setMode(resolved === 'dark' ? 'light' : 'dark')}
    >
      {resolved === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
    </IconButton>
  );
}

export function Nav() {
  return (
    <AppBar
      position="sticky"
      color="default"
      enableColorOnDark
      sx={{
        bgcolor: 'background.paper',
        borderBottom: '3px solid #4A5568',
        boxShadow: 'inset 0 -3px 0 0 #FFB000',
      }}
    >
      <Container maxWidth="lg">
        <Toolbar disableGutters>
          <Typography
            variant="h6"
            component="a"
            href="#top"
            sx={{ flexGrow: 1, color: 'inherit', textDecoration: 'none', fontWeight: 600 }}
          >
            {site.name}
          </Typography>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            {copy.navLinks.map((link) => (
              <Button
                key={link.href}
                href={link.href}
                color="inherit"
                sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
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
