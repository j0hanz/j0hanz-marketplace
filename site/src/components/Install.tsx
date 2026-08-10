import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { copy } from '../copy';
import { site } from '../site';
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

export function Install() {
  return (
    <Section id="install" title={copy.installTitle}>
      <Stack component="ol" spacing={3} sx={{ listStyle: 'none', p: 0, m: 0, maxWidth: 560 }}>
        {steps.map((step, i) => (
          <Stack key={step.label} component="li" spacing={1}>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
              Step {i + 1} — {step.label}
            </Typography>
            <Command value={step.value} />
          </Stack>
        ))}
      </Stack>
    </Section>
  );
}
