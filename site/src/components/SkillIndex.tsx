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
import { useEffect, useState } from 'react';
import { ExpandMoreIcon } from '../icons';
import { plural, site } from '../site';
import { codeSx } from '../theme/tokens';
import { PluginCountChips } from './PluginCountChips';
import { Section } from './Section';

const useMatchMedia = (query: string) => {
  // `mounted` gates the read: server renders with `false`, the first client render
  // matches that, and only after mount does the real media query take effect. Without
  // it, Accordion's uncontrolled `defaultExpanded` would flip between server HTML and
  // client hydration on a desktop viewport.
  const [mounted, setMounted] = useState(false);
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    setMatches(mq.matches);
    setMounted(true);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);
  return mounted && matches;
};

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
        // characters a line, roughly twice a readable measure.
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
  // First accordion opens by default on desktop, where the visitor is scanning for a
  // specific plugin. On a phone the section starts collapsed so the page does not eat a
  // screen before reaching Install.
  const isDesktop = useMatchMedia('(min-width: 900px)');

  return (
    <Section
      id="skills"
      // The list carries agents as well as skills. The chip shows the sum; spelling out both
      // halves is exact at every count, where "N skills and agents" is only right by luck.
      title="Skills and agents"
      count={{
        total: site.totals.skills + site.totals.agents,
        label: `${plural(site.totals.skills, 'skill')} and ${plural(site.totals.agents, 'agent')}`,
      }}
    >
      {site.plugins.map((plugin, i) => (
        <Accordion
          key={plugin.name}
          defaultExpanded={isDesktop && i === 0}
          disableGutters
          square
          elevation={0}
          // Six collapsed rows inside one raised paper slab is a box holding almost nothing.
          // Hairline-divided rows on the page ground instead; the open row takes the amber
          // edge, the same signal the nav and cards use.
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
            {/* A span, not an h3: AccordionSummary already wraps itself in one, so this was
                an h3 inside an h3 and every plugin was listed twice in the outline. */}
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
                  extra={<Chip size="small" variant="outlined" label="agent" />}
                />
              ))}
            </List>
          </AccordionDetails>
        </Accordion>
      ))}
    </Section>
  );
}
