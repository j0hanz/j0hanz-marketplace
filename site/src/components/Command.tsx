import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useEffect, useRef, useState } from 'react';
import { CheckIcon, ContentCopyIcon } from '../icons';
import { codeSx, srOnly } from '../theme/tokens';

// Three states, not a boolean: `writeText` rejects on an insecure origin and whenever the
// permission is denied, and a boolean has no way to say so — the button just went on reading
// "Copy" while nothing reached the clipboard, which is the one failure a copy button must not
// keep quiet about.
type Status = '' | 'Copied' | 'Copy failed';

export function Command({ value }: { value: string }) {
  const [status, setStatus] = useState<Status>('');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // The countdown restarts on the click, not on the state changing: two copies inside the
  // window leave `status` at the same value, so an effect keyed to it never re-ran and the
  // second confirmation expired on the first one's timer.
  const announce = (next: Status) => {
    setStatus(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus(''), 1600);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const copied = status === 'Copied';
  const tip = status || 'Copy';
  const Icon = copied ? CheckIcon : ContentCopyIcon;
  // Lifted out of the icon: three colours is one ternary past the point of reading.
  const iconColor = copied ? 'primary' : status ? 'error' : undefined;

  return (
    <Paper
      variant="outlined"
      // A recessed bar, not another box: every command sits inside something already framed
      // (a card, the hero bezel, the install rail). 1px edge hairline keeps the bar
      // visible inside the white hero bezel without competing with the 3px chassis.
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        pl: 1.5,
        pr: 0.5,
        py: 0.5,
        width: 1,
        bgcolor: 'background.default',
        borderColor: 'var(--mui-palette-edge)',
        borderWidth: 1,
      }}
    >
      <Typography component="code" variant="body2" sx={{ flexGrow: 1, minWidth: 0, ...codeSx }}>
        {value}
      </Typography>
      {/* The command is in the label. Ten of these render on the page, and named for the
          verb alone they were ten identical "Copy" entries in a screen reader's button
          list with nothing to pick between them. */}
      <Tooltip title={tip}>
        <IconButton
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              announce('Copied');
            } catch {
              announce('Copy failed');
            }
          }}
          aria-label={`Copy ${value}`}
          sx={{ p: 1.5 }}
        >
          {/* The tooltip carries the words, but it only opens on hover — on a touch screen
              the tint is the whole of the failure notice a sighted visitor gets. */}
          <Icon fontSize="small" color={iconColor} />
        </IconButton>
      </Tooltip>
      {/* Idle says nothing: the button already carries its own label. */}
      <Box component="span" role="status" sx={srOnly}>
        {status}
      </Box>
    </Paper>
  );
}
