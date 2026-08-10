import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { site } from '../site';
import { mono, steel } from '../theme/tokens';
import { Command } from './Command';
import { Section } from './Section';

// Steps 2 and 3 use one real plugin so the visitor sees a worked install trace, not a
// placeholder they have to substitute. build-site-data.mjs refuses to emit data without one.
const [example] = site.plugins.flatMap((p) =>
  p.skills.flatMap((s) => (s.command ? [{ install: p.installCommand, run: s.command }] : [])),
);

const steps = [
  { label: 'Add the marketplace', value: site.addCommand },
  { label: 'Install a plugin', value: example.install },
  { label: 'Run it', value: example.run },
];

const MARKER = 28;

export function Install() {
  return (
    /* No paper band. The rail is 620px of a 1200px measure, and a full-bleed ground with
       steel edges drew a frame around the 580px of nothing beside it. */
    <Section id="install" title="Install">
      {/* A rail, not a stack of labelled blocks: the numerals are the ordinal, so each step's
          heading can be the thing it does rather than the word "Step". Plain Box, not Stack —
          Stack zeroes its children's margins, and the rail needs the list indented off the
          measure. `list-style: none` drops list semantics in Safari, so the role puts them
          back. */}
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
                ml: `${MARKER / 2}px`,
                pl: { xs: 3, sm: 4 },
                pb: last ? 0 : 5,
                // The rail runs through the gutter and stops at the last marker, so the
                // sequence reads as connected without drawing a line into empty space.
                borderLeft: '3px solid',
                borderColor: last ? 'transparent' : steel,
              }}
            >
              <Box
                aria-hidden
                sx={{
                  position: 'absolute',
                  // Centered on the rail: the rail is the parent's left border, and the
                  // marker sits half its width on either side regardless of padding changes.
                  left: 0,
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
                  // Marker center sits on the rail: absolute `left: 0` resolves to the
                  // padding-box edge (1.5px inside the 3px border), so translate by half
                  // the marker plus half the border to land it on the border line.
                  transform: `translate(${-(MARKER / 2 + 1.5)}px, 0)`,
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
