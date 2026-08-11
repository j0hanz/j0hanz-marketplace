import Chip from '@mui/material/Chip';
import { countLabel, type Plugin } from '../site';

export function CountChips({ plugin }: { plugin: Plugin }) {
  return (
    <>
      {plugin.skills.length > 0 && (
        <Chip size="small" variant="outlined" label={countLabel(plugin.skills.length, 'skill')} />
      )}
      {plugin.agents.length > 0 && (
        <Chip size="small" variant="outlined" label={countLabel(plugin.agents.length, 'agent')} />
      )}
    </>
  );
}
