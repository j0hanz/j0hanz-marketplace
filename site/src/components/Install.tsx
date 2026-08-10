import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { site } from '../site';
import { mono, steel } from '../theme/tokens';
import { Command } from './Command';
import { Section } from './Section';

const example = site.plugins
  .flatMap((p) =>
    p.skills.flatMap((s) => (s.command ? [{ install: p.installCommand, run: s.command }] : [])),
  )
  .find(Boolean)!;

const steps = [
  { label: 'Add the marketplace', value: site.addCommand },
  { label: 'Install a plugin', value: example.install },
  { label: 'Run it', value: example.run },
];

const MARKER_SIZE = 28;
const RAIL_WIDTH = 3;

export function Install() {
  return (
    <Section id="install" title="Install">
      <Box component="ol" role="list" sx={{ listStyle: 'none', p: 0, m: 0, maxWidth: 620 }}>
        {steps.map((step, i) => {
          const last = i === steps.length - 1;
          return (
            <Box
              component="li"
              key={step.label}
              data-reveal
              sx={{
                position: 'relative',
                ml: `${MARKER_SIZE / 2}px`,
                pl: { xs: 3, sm: 4 },
                pb: last ? 0 : 5,
                borderLeft: `${RAIL_WIDTH}px solid`,
                borderColor: last ? 'transparent' : steel,
              }}
            >
              <Box
                aria-hidden
                sx={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: MARKER_SIZE,
                  height: MARKER_SIZE,
                  display: 'grid',
                  placeItems: 'center',
                  fontFamily: mono,
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  transform: `translate(${-(MARKER_SIZE / 2 + RAIL_WIDTH / 2)}px, 0)`,
                }}
              >
                {i + 1}
              </Box>
              <Stack spacing={1.5} sx={{ minWidth: 0, pt: 0.5 }}>
                <Typography component="h3" variant="body2" sx={{ fontWeight: 600 }}>
                  {step.label}
                </Typography>
                <Command value={step.value} />
              </Stack>
            </Box>
          );
        })}
      </Box>
    </Section>
  );
}
