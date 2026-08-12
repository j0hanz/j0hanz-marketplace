import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
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
import { useEnter } from '../hooks/useEnter';
import { countLabel, type Plugin } from '../site';
import { codeSx, lit, outline, tag } from '../theme/tokens';
import { CountChips } from './CountChips';
import { Section } from './Section';

const MODEL_LOADED = 'Claude auto-loads this skill. It is not a user-facing slash command.';

const sum = (plugins: Plugin[], of: (plugin: Plugin) => number) =>
  plugins.reduce((n, plugin) => n + of(plugin), 0);

// The counts a row carries, as one phrase: the summary is a button, and its chips
// would otherwise join its name — and the heading MUI wraps it in — unspaced.
const counts = (plugin: Plugin) =>
  [
    plugin.skills.length && countLabel(plugin.skills.length, 'skill'),
    plugin.agents.length && countLabel(plugin.agents.length, 'agent'),
  ]
    .filter(Boolean)
    .join(', ');

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
    <ListItem disableGutters alignItems="flex-start">
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

/** Names what kind of entry a row is. Counting is the chips' job. */
function Kind({ label, title }: { label: string; title?: string }) {
  const text = (
    <Typography
      component="span"
      variant="caption"
      color="textSecondary"
      tabIndex={title ? 0 : undefined}
      aria-label={title ? `${label}. ${title}` : undefined}
      sx={{ ...tag, py: 0.5 }}
    >
      {label}
    </Typography>
  );
  return title ? <Tooltip title={title}>{text}</Tooltip> : text;
}

export function SkillIndex({ visible, needle }: { visible: Plugin[]; needle: string }) {
  const isDesktop = useMediaQuery((t) => t.breakpoints.up('md'));
  const [overrides, setOverrides] = useState<Partial<Record<string, boolean>>>({});
  const firstPluginName = visible[0]?.name;
  // A search is a question about what is inside these rows, so it opens them.
  const isOpen = (name: string, map = overrides) =>
    map[name] ?? (Boolean(needle) || (isDesktop && name === firstPluginName));
  const toggle = (name: string) =>
    setOverrides((prev) => ({ ...prev, [name]: !isOpen(name, prev) }));

  const listRef = useRef<HTMLDivElement>(null);
  useEnter(listRef, visible);

  const skills = sum(visible, (plugin) => plugin.skills.length);
  const agents = sum(visible, (plugin) => plugin.agents.length);

  return (
    <Section
      id="skills"
      title="Skills and agents"
      count={{
        total: skills + agents,
        label: `${countLabel(skills, 'skill')} and ${countLabel(agents, 'agent')}`,
      }}
    >
      <div ref={listRef}>
        {visible.length === 0 ? (
          <Typography variant="body1" color="textSecondary" sx={{ py: 6, px: 3, border: outline }}>
            Nothing to list while the plugins above are filtered out.
          </Typography>
        ) : (
          visible.map((plugin) => (
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
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                aria-label={`${plugin.displayName}: ${counts(plugin)}`}
                sx={{ px: { xs: 1.5, sm: 2 } }}
              >
                <Typography
                  component="span"
                  variant="h6"
                  sx={{ flexGrow: 1, minWidth: 0, fontSize: '1rem' }}
                >
                  {plugin.displayName}
                </Typography>
                <Stack
                  direction="row"
                  spacing={1}
                  aria-hidden
                  sx={{ mr: 2, flexShrink: 0, alignSelf: 'center' }}
                >
                  <CountChips plugin={plugin} />
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
                          <Kind label="model-loaded" title={MODEL_LOADED} />
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
                      trailing={<Kind label="agent" />}
                    />
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>
          ))
        )}
      </div>
    </Section>
  );
}
