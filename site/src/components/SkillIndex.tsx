import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography, { type TypographyProps } from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import type { ReactNode } from 'react';
import { ExpandMoreIcon } from '../icons';
import { countLabel, type Plugin } from '../site';
import { codeSx, lit, outline, tag } from '../theme/tokens';
import { CountChips } from './CountChips';
import { RevealOnEnter } from './RevealOnEnter';
import { Section } from './Section';

const MODEL_LOADED = 'Claude auto-loads this skill. It is not a user-facing slash command.';

const sum = (plugins: Plugin[], of: (plugin: Plugin) => number) =>
  plugins.reduce((n, plugin) => n + of(plugin), 0);

const counts = (plugin: Plugin) =>
  [
    plugin.skills.length && countLabel(plugin.skills.length, 'skill'),
    plugin.agents.length && countLabel(plugin.agents.length, 'agent'),
  ]
    .filter(Boolean)
    .join(', ');

const tagSx = { ...tag, py: 0.5 } as const;

/** Metadata voice beside a name: the kind of entry, or the hint it takes. */
const Tag = (props: TypographyProps) => (
  <Typography component="span" variant="caption" color="textSecondary" sx={tagSx} {...props} />
);

/** The row shell: whatever the caller lines up on top, its description beneath. */
function Entry({ description, children }: { description: string; children: ReactNode }) {
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
            {children}
          </Stack>
        }
        secondary={description}
      />
    </ListItem>
  );
}

export function SkillIndex({ visible, searching }: { visible: Plugin[]; searching: boolean }) {
  const isDesktop = useMediaQuery((t) => t.breakpoints.up('md'));
  const firstPluginName = visible[0]?.name;

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
      {visible.length === 0 ? (
        <Typography variant="body1" color="textSecondary" sx={{ py: 6, px: 3, border: outline }}>
          Nothing to list while the plugins above are filtered out.
        </Typography>
      ) : (
        <RevealOnEnter dep={visible.length}>
          {visible.map((plugin) => {
            const openByDefault = searching || (isDesktop && plugin.name === firstPluginName);
            return (
              <Accordion
                key={`${plugin.name}-${openByDefault}`}
                defaultExpanded={openByDefault}
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
                      <Entry key={skill.name} description={skill.description}>
                        {!skill.command && (
                          <Tooltip title={MODEL_LOADED}>
                            <Tag tabIndex={0} aria-label={`model-loaded. ${MODEL_LOADED}`}>
                              model-loaded
                            </Tag>
                          </Tooltip>
                        )}
                        <Typography component="code" variant="body2" sx={codeSx}>
                          {skill.command ?? skill.name}
                        </Typography>
                        {skill.argumentHint && (
                          <Tag component="code" sx={codeSx}>
                            {skill.argumentHint}
                          </Tag>
                        )}
                      </Entry>
                    ))}
                    {plugin.agents.map((agent) => (
                      <Entry key={agent.name} description={agent.description}>
                        <Typography component="code" variant="body2" sx={codeSx}>
                          {agent.name}
                        </Typography>
                        <Tag>agent</Tag>
                      </Entry>
                    ))}
                  </List>
                </AccordionDetails>
              </Accordion>
            );
          })}
        </RevealOnEnter>
      )}
    </Section>
  );
}
