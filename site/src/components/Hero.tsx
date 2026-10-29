import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { clientName } from '../clients';
import { ArrowDownwardIcon, GitHubIcon } from '../icons';
import { type ClientId, external, externalLabel, site } from '../site';
import { mono, rule, tag } from '../theme/tokens';
import { ClientPicker } from './ClientPicker';
import { Command } from './Command';

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

export function Hero({
  client,
  onClient,
}: {
  client: ClientId;
  onClient: (next: ClientId) => void;
}) {
  const steps = site.steps[client];
  return (
    <Container component="section" id="top" maxWidth="lg" sx={{ pt: { xs: 5, md: 6 }, pb: 4 }}>
      {/* Both columns start on the same line, so the panel's lit top rule sits
          with the headline's first cap rather than floating against its middle. */}
      <Grid container spacing={{ xs: 5, md: 2 }} sx={{ alignItems: 'start' }}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Stack spacing={{ xs: 2, md: 3 }} sx={{ alignItems: 'flex-start' }}>
            <Typography variant="h2" component="h1" data-hero sx={{ '--i': 0 }}>
              Plugins for coding agents
            </Typography>
            {/* What the headline leaves to be counted. Same sentence the tab and
                the search result carry, so the page opens the way it was found. */}
            <Typography
              variant="body1"
              color="textSecondary"
              data-hero
              sx={{ '--i': 1, maxWidth: '46ch' }}
            >
              {site.tagline}
            </Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={{ xs: 1.5, sm: 2 }}
              sx={{ width: 1, '--i': 2 }}
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
                {...external}
                aria-label={externalLabel('GitHub')}
                startIcon={<GitHubIcon />}
              >
                GitHub
              </Button>
            </Stack>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          {/* The picker heads the panel because it decides every command below it, and
              the catalog's cards follow the same choice. */}
          <Stack spacing={2.5} sx={{ p: 2, bgcolor: 'background.paper', border: rule }}>
            <Box data-hero-panel sx={{ '--i': 0 }}>
              <ClientPicker value={client} onChange={onClient} />
            </Box>
            <Stack
              component="ol"
              role="list"
              aria-label={`Get started in ${clientName(client)}`}
              spacing={2.5}
              sx={{ listStyle: 'none', m: 0, p: 0 }}
            >
              {steps.map((step, i) => (
                <Box component="li" key={step.label} data-hero-panel sx={{ '--i': i + 1 }}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1 }}>
                    <Box aria-hidden sx={marker}>
                      {i + 1}
                    </Box>
                    <Typography variant="caption" color="textSecondary" sx={tag}>
                      {step.label}
                    </Typography>
                  </Stack>
                  <Command value={step.value} />
                </Box>
              ))}
            </Stack>
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}
