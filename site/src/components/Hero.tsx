import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useCountUp } from '../hooks/useCountUp';
import { ArrowDownwardIcon, GitHubIcon } from '../icons';
import { pluralize, site } from '../site';
import { lit, mono, rule } from '../theme/tokens';
import { Command } from './Command';

const stats = [
  { count: site.totals.plugins, unit: 'plugin' },
  { count: site.totals.skills, unit: 'skill' },
  { count: site.totals.agents, unit: 'agent' },
];

// Reads the same flag main.tsx sets — `true` only when JS runs and the visitor
// allows motion. The panel wipe takes 520ms with a 220ms delay, so the count
// starts on the wipe's last frame and reads as a settling into the number.
const COUNT_DELAY = 740;

function StatNumber({ value }: { value: number }) {
  const motion =
    typeof document !== 'undefined' && document.documentElement.dataset.motion !== undefined;
  const reduced =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const n = useCountUp(value, COUNT_DELAY, motion && !reduced);
  return (
    <Typography sx={{ fontFamily: mono, fontWeight: 700, lineHeight: 1.2, fontSize: '1.75rem' }}>
      {n}
    </Typography>
  );
}

// The one authored moment (index.css): the pitch rises, then the marketplace
// panel wipes in behind its own frame. Everything after it is quieter by design.
export function Hero() {
  return (
    <Container
      component="section"
      id="top"
      maxWidth="lg"
      sx={{ pt: { xs: 6, md: 11 }, pb: { xs: 4, md: 6 } }}
    >
      <Grid container spacing={{ xs: 5, md: 6 }} sx={{ alignItems: 'center' }}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Stack spacing={{ xs: 3, md: 4 }} sx={{ alignItems: 'flex-start' }}>
            <Typography variant="h2" component="h1" data-hero sx={{ '--i': 0 }}>
              Skills and agents for Claude Code.
            </Typography>
            <Typography
              variant="body1"
              color="textSecondary"
              sx={{ maxWidth: '48ch', '--i': 1 }}
              data-hero
            >
              Install one plugin at a time. No build step, no dependencies.
            </Typography>
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
                data-arrow-nudge=""
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
            spacing={2}
            data-hero-panel
            sx={{ p: 2, bgcolor: 'background.paper', border: rule, boxShadow: lit('top') }}
          >
            <Typography
              component="p"
              variant="caption"
              color="textSecondary"
              sx={{ fontFamily: mono, textTransform: 'uppercase', letterSpacing: '0.12em' }}
            >
              Add the marketplace
            </Typography>
            <Command value={site.addCommand} />

            <Stack
              component="ul"
              direction="row"
              sx={{
                listStyle: 'none',
                p: 0,
                m: 0,
                pt: 2,
                borderTop: 1,
                borderColor: 'divider',
                '& > li + li': { pl: 2, borderLeft: 1, borderColor: 'divider' },
                '& > li': { flex: 1, minWidth: 0 },
              }}
            >
              {stats.map((stat) => (
                <Box component="li" key={stat.unit}>
                  <StatNumber value={stat.count} />
                  <Typography variant="caption" color="textSecondary">
                    {pluralize(stat.count, stat.unit)}
                  </Typography>
                </Box>
              ))}
            </Stack>

            <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
              Skills are slash commands you run. Agents are helpers Claude delegates work to.
            </Typography>
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}
