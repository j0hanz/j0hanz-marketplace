import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useEffect, useRef, useState } from 'react';
import { CheckIcon, ContentCopyIcon } from '../icons';
import { codeSx, srOnly } from '../theme/tokens';

// Both strings are read aloud and branched on, so they are named once.
const COPIED = 'Copied';
const FAILED = 'Copy failed. Select the text and copy it';

type Status = '' | typeof COPIED | typeof FAILED;

export function Command({ value }: { value: string }) {
  const [status, setStatus] = useState<Status>('');
  // Gates the icon swap and keys it: the page holds ten of these and none should
  // animate on first paint, and a repeated failure swaps the same glyph back in.
  const [presses, setPresses] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const announce = (next: Status) => {
    setPresses((n) => n + 1);
    setStatus(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus(''), 1600);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      announce(COPIED);
    } catch {
      announce(FAILED);
    }
  };

  const copied = status === COPIED;
  const tip = status || 'Copy';
  const Icon = copied ? CheckIcon : ContentCopyIcon;
  const iconColor = copied ? 'primary' : status ? 'error' : undefined;
  const swap = presses && !copied ? presses : undefined;

  return (
    <Paper
      variant="outlined"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        pl: 1.5,
        py: 0.5,
        bgcolor: 'background.default',
      }}
    >
      <Typography component="code" variant="caption" sx={{ flexGrow: 1, minWidth: 0, ...codeSx }}>
        {value}
      </Typography>
      <Tooltip title={tip}>
        <IconButton onClick={copy} aria-label={`Copy ${value}`}>
          <Icon key={presses} fontSize="small" color={iconColor} data-swap-in={swap} />
        </IconButton>
      </Tooltip>
      <Box component="span" role="status" sx={srOnly}>
        {status}
      </Box>
    </Paper>
  );
}
