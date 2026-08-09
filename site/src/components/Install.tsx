import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { copy } from '../copy';
import { site } from '../site';
import { Command } from './Command';
import { Section } from './Section';

// Steps two and three are command shapes rather than one arbitrary plugin's command;
// the exact per-plugin command lives on its catalog card. Step three resolves to the
// first invocable skill across the catalog so the visitor sees a real shape.
const exampleInvocation = (() => {
  for (const p of site.plugins) {
    const skill = p.skills.find((s) => s.invocable && s.command);
    if (skill) return `/${p.name}:${skill.command}`;
  }
  return '/<plugin>:<skill>';
})();

const rows = [
  { label: copy.installSteps[0], value: site.addCommand },
  { label: copy.installSteps[1], value: `/plugin install <plugin>@${site.name}` },
  { label: copy.installSteps[2], value: exampleInvocation },
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
