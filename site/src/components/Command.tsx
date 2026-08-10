import CheckIcon from '@mui/icons-material/Check';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useEffect, useRef, useState } from 'react';
import { copy } from '../copy';
import { codeSx, srOnly } from '../theme';

type CopyState = 'idle' | 'copied' | 'select';

export function Command({ value }: { value: string }) {
  const [state, setState] = useState<CopyState>('idle');
  const code = useRef<HTMLElement>(null);

  useEffect(() => {
    if (state === 'idle') return;
    const timer = setTimeout(() => setState('idle'), 1600);
    return () => clearTimeout(timer);
  }, [state]);

  const copyOrSelect = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
    } catch {
      // Clipboard denied or unavailable (insecure context). Select the command instead,
      // so the keyboard copy still works rather than the button doing nothing.
      if (!code.current) return;
      const range = document.createRange();
      range.selectNodeContents(code.current);
      const selection = getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      setState('select');
    }
  };

  const tip =
    state === 'copied' ? copy.copiedLabel : state === 'select' ? copy.selectLabel : copy.copyLabel;
  const Icon = state === 'copied' ? CheckIcon : ContentCopyIcon;
  const iconColor = state === 'copied' ? 'primary' : undefined;

  return (
    <Paper
      variant="outlined"
      sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 1.5, pr: 0.5, py: 0.5, width: 1 }}
    >
      <Typography
        ref={code}
        component="code"
        variant="body2"
        sx={{ flexGrow: 1, minWidth: 0, ...codeSx }}
      >
        {value}
      </Typography>
      <Tooltip title={tip}>
        <IconButton onClick={copyOrSelect} aria-label={copy.copyLabel} sx={{ p: 1.5 }}>
          <Icon fontSize="small" color={iconColor} />
        </IconButton>
      </Tooltip>
      {/* Idle says nothing: the button already carries its own label. */}
      <Box component="span" role="status" sx={srOnly}>
        {state === 'idle' ? '' : tip}
      </Box>
    </Paper>
  );
}
