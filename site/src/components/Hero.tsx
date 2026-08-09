import GitHubIcon from '@mui/icons-material/GitHub';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { copy, pluralWord } from '../copy';
import { site } from '../site';
import { Command } from './Command';

const stats = [
  { count: site.totals.plugins, unit: copy.unit.plugin },
  { count: site.totals.skills, unit: copy.unit.skill },
  { count: site.totals.agents, unit: copy.unit.agent },
];

export function Hero() {
  return (
    <Container component="section" id="top" maxWidth="lg" sx={{ py: { xs: 8, md: 14 } }}>
      <Stack spacing={4} sx={{ maxWidth: 720 }}>
        <Typography variant="h2" component="h1" sx={{ fontWeight: 600, letterSpacing: '-0.02em' }}>
          {copy.heroTitle}
        </Typography>
        <Typography variant="h6" component="p" color="text.secondary" sx={{ fontWeight: 400 }}>
          {copy.heroBody}
        </Typography>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Button variant="contained" size="large" href={copy.heroPrimaryHref} disableElevation>
            {copy.heroPrimary}
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
            {copy.heroSecondary}
          </Button>
        </Stack>

        <Box sx={{ maxWidth: 520 }}>
          <Command value={site.addCommand} />
        </Box>

        <Stack
          component="ul"
          direction="row"
          spacing={3}
          divider={<Divider orientation="vertical" flexItem />}
          sx={{ listStyle: 'none', p: 0, m: 0 }}
        >
          {stats.map((stat) => (
            <Stack
              key={stat.unit}
              component="li"
              direction="row"
              spacing={1}
              sx={{ alignItems: 'baseline' }}
            >
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                {stat.count}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {pluralWord(stat.count, stat.unit)}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Stack>
    </Container>
  );
}
