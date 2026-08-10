import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
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
import { copy, plural } from '../copy';
import { site } from '../site';
import { codeSx } from '../theme';
import { PluginCountChips } from './PluginCountChips';
import { Section } from './Section';

/** One row: the invocation on top, its description below. Same shape for skills and agents. */
function Entry({
  code,
  description,
  extra,
  leading,
}: {
  code: string;
  description: string;
  extra?: ReactNode;
  leading?: ReactNode;
}) {
  return (
    <ListItem disableGutters divider alignItems="flex-start">
      <ListItemText
        // Skill descriptions are full sentences; at container width they run past 140
        // characters a line, which is roughly twice a readable measure.
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
            {extra}
          </Stack>
        }
        secondary={description}
      />
    </ListItem>
  );
}

export function SkillIndex() {
  return (
    <Section
      id="skills"
      title={copy.skillsTitle}
      // The chip shows the sum; spelling out both halves is exact at every count, where
      // "N skills and agents" is only ever right by luck.
      count={{
        total: site.totals.skills + site.totals.agents,
        label: `${plural(site.totals.skills, copy.unit.skill)} and ${plural(site.totals.agents, copy.unit.agent)}`,
      }}
    >
      {site.plugins.map((plugin, i) => (
        <Accordion
          key={plugin.name}
          defaultExpanded={i === 0}
          disableGutters
          square
          elevation={0}
          // Six collapsed rows inside one raised paper slab is a box holding almost
          // nothing. Dropped to hairline-divided rows on the page ground; the open row
          // takes the amber edge, which is the same signal the nav and cards use.
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
            {/* A span, not an h3: AccordionSummary already wraps itself in one, so this
                was an h3 inside an h3 and every plugin was listed twice in the outline. */}
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
                    !skill.invocable ? (
                      <Tooltip title={copy.modelLoadedHint}>
                        <Chip
                          size="small"
                          variant="outlined"
                          tabIndex={0}
                          label={copy.modelLoadedTag}
                        />
                      </Tooltip>
                    ) : undefined
                  }
                  extra={
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
                  extra={<Chip size="small" variant="outlined" label={copy.agentTag} />}
                />
              ))}
            </List>
          </AccordionDetails>
        </Accordion>
      ))}
    </Section>
  );
}
