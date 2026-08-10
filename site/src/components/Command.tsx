import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useEffect, useRef, useState } from 'react';
import { CheckIcon, ContentCopyIcon } from '../icons';
import { codeSx, srOnly } from '../theme/tokens';

type Status = '' | 'Copied' | 'Copy failed';

export function Command({ value }: { value: string }) {
  const [status, setStatus] = useState<Status>('');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const announce = (next: Status) => {
    setStatus(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus(''), 1600);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const copied = status === 'Copied';
  const tip = status || 'Copy';
  const Icon = copied ? CheckIcon : ContentCopyIcon;
  const iconColor = copied ? 'primary' : status ? 'error' : undefined;

  return (
    <Paper
      variant="outlined"
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
          <Icon fontSize="small" color={iconColor} />
        </IconButton>
      </Tooltip>
      <Box component="span" role="status" sx={srOnly}>
        {status}
      </Box>
    </Paper>
  );
}
