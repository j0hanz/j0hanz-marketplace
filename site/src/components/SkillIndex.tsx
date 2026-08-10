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
import useMediaQuery from '@mui/material/useMediaQuery';
import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import { ExpandMoreIcon } from '../icons';
import { useEnter } from '../motion';
import { countLabel, site } from '../site';
import { codeSx, lit, outline } from '../theme/tokens';
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
  const isDesktop = useMediaQuery((t) => t.breakpoints.up('md'));

  // Rows the user explicitly toggled away from the viewport default. Kept so a
  // resize doesn't undo a deliberate collapse.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const firstName = site.plugins[0]?.name;
  const isOpen = (name: string) => overrides[name] ?? (isDesktop && name === firstName);
  const toggle = (name: string) => setOverrides((prev) => ({ ...prev, [name]: !isOpen(name) }));

  const listRef = useRef<HTMLDivElement>(null);
  // Structural wrapper: gives `useEnter` a single scope to query descendants
  // from, so per-Accordion refs aren't needed.
  useEnter(listRef);

  return (
    <Section
      id="skills"
      title="Skills and agents"
      count={{
        total: site.totals.skills + site.totals.agents,
        label: `${countLabel(site.totals.skills, 'skill')} and ${countLabel(site.totals.agents, 'agent')}`,
      }}
    >
      <div ref={listRef}>
        {site.plugins.map((plugin) => (
          <Accordion
            key={plugin.name}
            expanded={isOpen(plugin.name)}
            onChange={() => toggle(plugin.name)}
            disableGutters
            square
            elevation={0}
            data-reveal
            sx={{
              bgcolor: 'transparent',
              borderTop: outline,
              '&:last-of-type': { borderBottom: outline },
              '&::before': { display: 'none' },
              '&.Mui-expanded': { boxShadow: lit('left') },
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: { xs: 1.5, sm: 2 } }}>
              <Typography component="span" variant="h6" sx={{ flexGrow: 1, fontSize: '1rem' }}>
                {plugin.displayName}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mr: 2 }}>
                {plugin.skills.length > 0 && (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={countLabel(plugin.skills.length, 'skill')}
                  />
                )}
                {plugin.agents.length > 0 && (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={countLabel(plugin.agents.length, 'agent')}
                  />
                )}
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
      </div>
    </Section>
  );
}
