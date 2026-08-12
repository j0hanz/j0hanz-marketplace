import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useEffect, useRef, useState } from 'react';
import { CheckIcon, ContentCopyIcon } from '../icons';
import { usePressedKey } from '../hooks/usePressedKey';
import { codeSx, srOnly } from '../theme/tokens';

type Status = 'idle' | 'copied' | 'failed';

export function Command({ value }: { value: string }) {
  const [status, setStatus] = useState<Status>('idle');
  const swap = usePressedKey();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const announce = (next: Status) => {
    swap.press();
    setStatus(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus('idle'), 1600);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      announce('copied');
    } catch {
      announce('failed');
    }
  };

  const copied = status === 'copied';
  const tip =
    status === 'idle'
      ? 'Copy'
      : status === 'copied'
        ? 'Copied'
        : 'Copy failed. Select the text and copy it';
  const Icon = copied ? CheckIcon : ContentCopyIcon;
  const iconColor = copied ? 'primary' : status === 'failed' ? 'error' : undefined;

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
          <Icon key={swap.key} fontSize="small" color={iconColor} data-swap-in={swap.pressed} />
        </IconButton>
      </Tooltip>
      <Box component="span" role="status" sx={srOnly}>
        {status === 'idle' ? '' : status === 'copied' ? 'Copied' : 'Copy failed'}
      </Box>
    </Paper>
  );
}
