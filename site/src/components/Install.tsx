import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { copy } from '../copy';
import { site } from '../site';
import { Command } from './Command';
import { Section } from './Section';

// Step 2 and 3 use one real plugin so the visitor sees a worked install trace,
// not a placeholder they have to substitute themselves. Tutor wins by being
// first in the catalog with an invocable skill that takes a clear argument.
const example = (() => {
  for (const p of site.plugins) {
    const skill = p.skills.find((s) => s.invocable && s.command);
    if (skill) return { plugin: p, skill };
  }
  return null;
})();

const rows = [
  { label: copy.installSteps[0], value: site.addCommand },
  {
    label: copy.installSteps[1],
    value: example ? example.plugin.installCommand : `/plugin install <plugin>@${site.name}`,
  },
  {
    label: copy.installSteps[2],
    value: example ? (example.skill.command ?? `/<plugin>:<skill>`) : '/<plugin>:<skill>',
  },
];

export function Install() {
  return (
    <Section id="install" title={copy.installTitle}>
      <Stack component="ol" spacing={3} sx={{ listStyle: 'none', p: 0, m: 0, maxWidth: 560 }}>
        {rows.map((row, i) => (
          <Stack key={row.label} component="li" spacing={1}>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
              Step {i + 1} — {row.label}
            </Typography>
            <Command value={row.value} />
          </Stack>
        ))}
      </Stack>
    </Section>
  );
}
