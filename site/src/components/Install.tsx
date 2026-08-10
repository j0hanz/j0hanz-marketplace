import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { copy } from '../copy';
import { site } from '../site';
import { mono, steel } from '../theme';
import { Command } from './Command';
import { Section } from './Section';

// Step 2 and 3 use one real plugin so the visitor sees a worked install trace, not a
// placeholder they have to substitute themselves. First catalog entry with an invocable
// skill wins; build-site-data.mjs refuses to emit data without one.
const [example] = site.plugins.flatMap((p) =>
  p.skills.flatMap((s) => (s.command ? [{ install: p.installCommand, run: s.command }] : [])),
);

const steps = [
  { label: copy.installSteps[0], value: site.addCommand },
  { label: copy.installSteps[1], value: example.install },
  { label: copy.installSteps[2], value: example.run },
];

const RAIL = 3;
const MARKER = 28;
// Centres the marker on the rail. Absolute offsets are measured from the padding box,
// which starts inside the border, so half the rail comes back off along with half the marker.
const markerLeft = `${-(RAIL / 2 + MARKER / 2)}px`;

export function Install() {
  return (
    <Section id="install" title={copy.installTitle} band>
      {/* A rail, not a stack of labelled blocks: the numerals are the ordinal, so the
          heading of each step can be the thing it does rather than the word "Step".
          Plain Box, not Stack — Stack zeroes its children's margins, and the rail needs
          the list indented off the measure. `list-style: none` drops list semantics in
          Safari, so the role puts them back. */}
      <Box component="ol" role="list" sx={{ listStyle: 'none', p: 0, m: 0, maxWidth: 620 }}>
        {steps.map((step, i) => {
          const last = i === steps.length - 1;
          return (
            <Box
              component="li"
              key={step.label}
              sx={{
                position: 'relative',
                ml: `${MARKER / 2}px`,
                pl: { xs: 3, sm: 4 },
                pb: last ? 0 : 5,
                // The rail runs through the gutter and stops at the last marker, so the
                // sequence reads as connected without drawing a line into empty space.
                borderLeft: `${RAIL}px solid`,
                borderColor: last ? 'transparent' : steel,
              }}
            >
              <Box
                aria-hidden
                sx={{
                  position: 'absolute',
                  left: markerLeft,
                  top: 0,
                  width: MARKER,
                  height: MARKER,
                  display: 'grid',
                  placeItems: 'center',
                  fontFamily: mono,
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
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
