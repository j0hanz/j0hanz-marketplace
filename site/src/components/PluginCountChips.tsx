import Chip from '@mui/material/Chip';
import { copy, plural } from '../copy';
import type { Plugin } from '../site';

/** The skills + agents count chips shared by the catalog card and the skill index. */
export function PluginCountChips({ plugin }: { plugin: Plugin }) {
  return (
    <>
      {plugin.skills.length > 0 && (
        <Chip size="small" label={plural(plugin.skills.length, copy.unit.skill)} />
      )}
      {plugin.agents.length > 0 && (
        <Chip size="small" label={plural(plugin.agents.length, copy.unit.agent)} />
      )}
    </>
  );
}
