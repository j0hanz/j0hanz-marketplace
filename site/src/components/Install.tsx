import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useRef } from 'react';
import { useEnter } from '../hooks/useEnter';
import { site } from '../site';
import { mono, rule, RULE_WIDTH } from '../theme/tokens';
import { Command } from './Command';
import { Section } from './Section';

const example = site.plugins.flatMap((plugin) =>
  plugin.skills.flatMap((skill) =>
    skill.command ? [{ install: plugin.installCommand, run: skill.command }] : [],
  ),
)[0];

const steps = [
  { label: 'Add the marketplace', value: site.addCommand },
  { label: 'Install a plugin', value: example.install },
  { label: 'Run it', value: example.run },
];

export function Install() {
  const listRef = useRef<HTMLOListElement>(null);
  useEnter(listRef);

  return (
    <Section id="install" title="Install">
      <Box
        component="ol"
        role="list"
        ref={listRef}
        sx={{
          listStyle: 'none',
          p: 0,
          m: 0,
          bgcolor: 'steel',
          border: rule,
          borderTopColor: 'primary.main',
          display: 'flex',
          flexWrap: 'wrap',
          gap: `${RULE_WIDTH}px`,
        }}
      >
        {steps.map((step, i) => (
          <Box
            component="li"
            key={step.label}
            data-reveal
            sx={{
              flex: '1 1 320px',
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              minWidth: 0,
              bgcolor: 'background.paper',
              p: { xs: 2, md: 3 },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                aria-hidden
                sx={{
                  flexShrink: 0,
                  width: 28,
                  height: 28,
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
              <Typography component="h3" variant="body2" sx={{ fontWeight: 600 }}>
                {step.label}
              </Typography>
            </Box>
            <Command value={step.value} />
          </Box>
        ))}
      </Box>
    </Section>
  );
}
