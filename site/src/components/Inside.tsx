import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import { capabilities } from '../capability';
import { commandFor } from '../catalog';
import { codeSx } from '../theme/tokens';
import { countLabel, site, type ClientId, type Plugin } from '../site';
import { RevealOnEnter } from './RevealOnEnter';
import { Section } from './Section';

const FEATURED = ['css', 'workbench', 'writeup', 'groundwork'];
const SHOWN = 4;

/** A cropped terminal pane: the plugin's real install line and the first entries it adds. */
function Pane({ plugin, command }: { plugin: Plugin; command: string }) {
  const entries = capabilities(plugin).flatMap((capability) => capability.entries);
  const counts = capabilities(plugin)
    .filter((capability) => capability.count > 0)
    .map((capability) => countLabel(capability.count, capability.label))
    .join(' · ');
  return (
    <Box
      data-ui
      data-reveal
      sx={{ bgcolor: '#0E1116', color: '#E7EBF0', p: 3, height: 1, minHeight: 240, ...codeSx }}
    >
      <Typography component="p" sx={{ color: '#F5A524', fontSize: 16, fontWeight: 700, mb: 2 }}>
        {plugin.displayName} · {counts}
      </Typography>
      <Box component="pre" sx={{ ...codeSx, m: 0, fontSize: 14, whiteSpace: 'pre-wrap' }}>
        {`> ${command}\n`}
        {entries.slice(0, SHOWN).map((entry) => `\n${entry.name}`)}
        {entries.length > SHOWN ? `\n+ ${entries.length - SHOWN} more` : ''}
      </Box>
    </Box>
  );
}

export function Inside({ client }: { client: ClientId }) {
  const panes = FEATURED.flatMap((name) => {
    const plugin = site.plugins.find((p) => p.name === name);
    const command = plugin && commandFor(plugin, client);
    return plugin && command ? [{ plugin, command }] : [];
  });
  if (panes.length === 0) return null;
  return (
    <Section id="inside" title="What a plugin adds">
      <RevealOnEnter>
        <Grid container spacing={3}>
          {panes.map(({ plugin, command }) => (
            <Grid key={plugin.name} size={{ xs: 12, sm: 6 }} data-reveal>
              <Pane plugin={plugin} command={command} />
            </Grid>
          ))}
        </Grid>
      </RevealOnEnter>
    </Section>
  );
}
