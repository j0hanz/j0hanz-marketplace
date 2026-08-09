import Box from '@mui/material/Box';
import Step from '@mui/material/Step';
import StepContent from '@mui/material/StepContent';
import StepLabel from '@mui/material/StepLabel';
import Stepper from '@mui/material/Stepper';
import { copy } from '../copy';
import { site } from '../site';
import { Command } from './Command';
import { Section } from './Section';

// Steps two and three are command shapes rather than one arbitrary plugin's command;
// the exact per-plugin command lives on its catalog card.
const rows = [
  { label: copy.installSteps[0], value: site.addCommand },
  { label: copy.installSteps[1], value: `/plugin install <plugin>@${site.name}` },
  { label: copy.installSteps[2], value: '/<plugin>:<skill>' },
];

export function Install() {
  return (
    <Section id="install" title={copy.installTitle}>
      <Stepper orientation="vertical" nonLinear activeStep={-1} sx={{ maxWidth: 560 }}>
        {rows.map((row) => (
          <Step key={row.label} active expanded>
            <StepLabel>{row.label}</StepLabel>
            <StepContent>
              <Box sx={{ pb: 1 }}>
                <Command value={row.value} />
              </Box>
            </StepContent>
          </Step>
        ))}
      </Stepper>
    </Section>
  );
}
