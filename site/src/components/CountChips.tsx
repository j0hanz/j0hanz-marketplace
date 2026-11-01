import Chip from '@mui/material/Chip';
import { capabilities } from '../capability';
import { countLabel, type Plugin } from '../site';

export function CountChips({ plugin }: { plugin: Plugin }) {
  return (
    <>
      {capabilities(plugin).map(({ kind, label, count }) =>
        count > 0 ? <Chip key={kind} size="small" label={countLabel(count, label)} /> : null,
      )}
    </>
  );
}
