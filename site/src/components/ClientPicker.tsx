import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import { CLIENTS } from '../clients';
import type { ClientId } from '../site';
import { segmented } from '../theme/tokens';

// Marks, not names: the three commands differ only in which tool runs them, and the icons
// say that in a third of the width. Each button still carries the name, for the tooltip and
// for anything that reads the page instead of looking at it.
export function ClientPicker({
  value,
  onChange,
}: {
  value: ClientId;
  onChange: (next: ClientId) => void;
}) {
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={value}
      onChange={(_, next: ClientId | null) => next && onChange(next)}
      aria-label="Show install commands for"
      sx={segmented}
    >
      {CLIENTS.map(({ id, name, Icon }) => (
        <Tooltip key={id} title={name}>
          <ToggleButton value={id} aria-label={name}>
            <Icon fontSize="small" />
          </ToggleButton>
        </Tooltip>
      ))}
    </ToggleButtonGroup>
  );
}
