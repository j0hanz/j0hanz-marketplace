import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ArrowDownwardIcon, GitHubIcon } from '../icons';
import { site } from '../site';
import { lit, mono, rule } from '../theme/tokens';
import { Command } from './Command';

// The three lines a visitor actually types, in the order they type them. The
// example is whichever plugin ships the first slash command; with none, the
// sequence is the one command that never depends on a plugin existing.
const example = site.plugins.flatMap((plugin) =>
  plugin.skills.flatMap((skill) =>
    skill.command ? [{ install: plugin.installCommand, run: skill.command }] : [],
  ),
)[0];

const steps = [
  { label: 'Add the marketplace', value: site.addCommand },
  ...(example
    ? [
        { label: 'Install a plugin', value: example.install },
        { label: 'Run it', value: example.run },
      ]
    : []),
];

const eyebrow = {
  fontFamily: mono,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.12em',
};

// Ordinals, not icons: these are the only numbered things on the page, and the
// number is the information — step 2 does not work before step 1.
const marker = {
  flexShrink: 0,
  width: 22,
  height: 22,
  display: 'grid',
  placeItems: 'center',
  fontFamily: mono,
  fontWeight: 700,
  fontSize: '0.75rem',
  lineHeight: 1,
  bgcolor: 'primary.main',
  color: 'primary.contrastText',
};

export function Hero() {
  return (
    <Container component="section" id="top" maxWidth="lg" sx={{ pt: { xs: 5, md: 6 }, pb: 4 }}>
      {/* Both columns start on the same line, so the panel's lit top rule sits
          with the headline's first cap rather than floating against its middle. */}
      <Grid container spacing={{ xs: 5, md: 6 }} sx={{ alignItems: 'start' }}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Stack spacing={{ xs: 3, md: 4 }} sx={{ alignItems: 'flex-start' }}>
            <Typography variant="h2" component="h1" data-hero sx={{ '--i': 0 }}>
              Skills and agents for Claude Code.
            </Typography>
            <Stack spacing={1.5} data-hero sx={{ maxWidth: '48ch', '--i': 1 }}>
              <Typography variant="body1">
                Skills are slash commands you run. Agents are helpers Claude delegates work to.
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Install one plugin at a time. No build step, no dependencies.
              </Typography>
            </Stack>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              sx={{ width: 1, '--i': 2, '& .MuiButton-root': { minHeight: 44 } }}
              data-hero
            >
              <Button
                variant="contained"
                size="large"
                href="#plugins"
                disableElevation
                endIcon={<ArrowDownwardIcon />}
              >
                Browse plugins
              </Button>
              <Button
                variant="outlined"
                size="large"
                color="inherit"
                href={site.repoUrl}
                target="_blank"
                rel="noreferrer"
                startIcon={<GitHubIcon />}
              >
                GitHub
              </Button>
            </Stack>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Stack
            component="ol"
            // list-style: none drops the list role in Safari, and with it the
            // count these steps are read by. The marker carries the ordinal for
            // anyone looking; the role keeps it for anyone listening.
            role="list"
            spacing={2.5}
            sx={{
              listStyle: 'none',
              m: 0,
              p: 2,
              bgcolor: 'background.paper',
              border: rule,
              boxShadow: lit('top'),
            }}
          >
            {steps.map((step, i) => (
              <Box component="li" key={step.label} data-hero-panel sx={{ '--i': i }}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1 }}>
                  <Box aria-hidden sx={marker}>
                    {i + 1}
                  </Box>
                  <Typography variant="caption" color="textSecondary" sx={eyebrow}>
                    {step.label}
                  </Typography>
                </Stack>
                <Command value={step.value} />
              </Box>
            ))}
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}
