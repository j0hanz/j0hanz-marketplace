import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useRef } from 'react';
import { useEnter } from '../motion';
import { site } from '../site';
import { lit, mono, rule } from '../theme/tokens';
import { Command } from './Command';
import { Section } from './Section';

const example = site.plugins.flatMap((plugin) =>
  plugin.skills.flatMap((skill) =>
    skill.command ? [{ install: plugin.installCommand, run: skill.command }] : [],
  ),
)[0];

const steps = [
  { label: 'Add the marketplace', value: site.addCommand },
  ...(example
    ? [
        { label: 'Install a plugin', value: example.install },
        { label: 'Run it', value: example.run },
      ]
    : []),
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
          border: rule,
          boxShadow: lit('top'),
          display: 'grid',
          gridTemplateColumns: { md: `repeat(${steps.length}, 1fr)` },
        }}
      >
        {steps.map((step, i) => (
          <Box
            component="li"
            key={step.label}
            data-reveal
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              minWidth: 0,
              p: { xs: 2, md: 3 },
              ...(i > 0 && { borderTop: { xs: rule, md: 0 }, borderLeft: { md: rule } }),
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
