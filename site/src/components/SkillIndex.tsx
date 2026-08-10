import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { ExpandMoreIcon } from '../icons';
import { countLabel, site } from '../site';
import { codeSx } from '../theme/tokens';
import { PluginCountChips } from './PluginCountChips';
import { Section } from './Section';

function Entry({
  code,
  description,
  leading,
  trailing,
}: {
  code: string;
  description: string;
  leading?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <ListItem disableGutters divider alignItems="flex-start">
      <ListItemText
        slotProps={{
          primary: { component: 'div' },
          secondary: { sx: { mt: 0.5, maxWidth: '72ch' } },
        }}
        primary={
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            sx={{ flexWrap: 'wrap', alignItems: 'center' }}
          >
            {leading}
            <Typography component="code" variant="body2" sx={codeSx}>
              {code}
            </Typography>
            {trailing}
          </Stack>
        }
        secondary={description}
      />
    </ListItem>
  );
}

export function SkillIndex() {
  const [isDesktop] = useState(() => matchMedia('(min-width: 900px)').matches);

  return (
    <Section
      id="skills"
      title="Skills and agents"
      count={{
        total: site.totals.skills + site.totals.agents,
        label: `${countLabel(site.totals.skills, 'skill')} and ${countLabel(site.totals.agents, 'agent')}`,
      }}
    >
      {site.plugins.map((plugin, i) => (
        <Accordion
          key={plugin.name}
          defaultExpanded={isDesktop && i === 0}
          disableGutters
          square
          elevation={0}
          data-reveal
          sx={{
            bgcolor: 'transparent',
            borderTop: 1,
            borderColor: 'divider',
            '&:last-of-type': { borderBottom: 1, borderColor: 'divider' },
            '&::before': { display: 'none' },
            '&.Mui-expanded': {
              boxShadow: 'inset 3px 0 0 0 var(--mui-palette-primary-main)',
            },
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: { xs: 1.5, sm: 2 } }}>
            <Typography component="span" variant="h6" sx={{ flexGrow: 1, fontSize: '1rem' }}>
              {plugin.displayName}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mr: 2 }}>
              <PluginCountChips plugin={plugin} />
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ px: { xs: 1.5, sm: 2 }, pt: 0 }}>
            <List disablePadding>
              {plugin.skills.map((skill) => (
                <Entry
                  key={skill.name}
                  code={skill.command ?? skill.name}
                  description={skill.description}
                  leading={
                    !skill.command ? (
                      <Tooltip title="Claude auto-loads this skill. It is not a user-facing slash command.">
                        <Chip size="small" variant="outlined" tabIndex={0} label="model-loaded" />
                      </Tooltip>
                    ) : undefined
                  }
                  trailing={
                    skill.argumentHint && (
                      <Typography
                        component="code"
                        variant="caption"
                        color="textSecondary"
                        sx={codeSx}
                      >
                        {skill.argumentHint}
                      </Typography>
                    )
                  }
                />
              ))}
              {plugin.agents.map((agent) => (
                <Entry
                  key={agent.name}
                  code={agent.name}
                  description={agent.description}
                  trailing={<Chip size="small" variant="outlined" label="agent" />}
                />
              ))}
            </List>
          </AccordionDetails>
        </Accordion>
      ))}
    </Section>
  );
}
