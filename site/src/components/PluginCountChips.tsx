import Chip from '@mui/material/Chip';
import { plural, type Plugin } from '../site';

export function PluginCountChips({ plugin }: { plugin: Plugin }) {
  return (
    <>
      {plugin.skills.length > 0 && (
        <Chip size="small" variant="outlined" label={plural(plugin.skills.length, 'skill')} />
      )}
      {plugin.agents.length > 0 && (
        <Chip size="small" variant="outlined" label={plural(plugin.agents.length, 'agent')} />
      )}
    </>
  );
}
