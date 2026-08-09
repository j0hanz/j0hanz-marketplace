import CheckIcon from '@mui/icons-material/Check';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import { copy } from '../copy';
import { mono } from '../theme';

/** A real, selectable command with a copy button. Not a picture of a terminal. */
export function Command({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  const write = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard denied or unavailable (insecure context). The command stays
      // selectable, so there is nothing to recover from.
    }
  };

  return (
    <Paper
      variant="outlined"
      sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 1.5, pr: 0.5, py: 0.5, width: 1 }}
    >
      <Typography
        component="code"
        variant="body2"
        sx={{ flexGrow: 1, fontFamily: mono, overflowX: 'auto', whiteSpace: 'nowrap' }}
      >
        {value}
      </Typography>
      <Tooltip title={copied ? copy.copiedLabel : copy.copyLabel}>
        <IconButton size="small" onClick={write} aria-label={`${copy.copyLabel} ${value}`}>
          {copied ? (
            <CheckIcon fontSize="small" color="primary" />
          ) : (
            <ContentCopyIcon fontSize="small" />
          )}
        </IconButton>
      </Tooltip>
    </Paper>
  );
}
