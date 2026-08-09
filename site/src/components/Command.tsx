import CheckIcon from '@mui/icons-material/Check';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useEffect, useRef, useState } from 'react';
import { copy } from '../copy';
import { mono } from '../theme';

// Announced, never seen. `width: 1` in sx means 100%, so these stay strings.
const srOnly = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
} as const;

/** A real, selectable command with a copy button. Not a picture of a terminal. */
export function Command({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const code = useRef<HTMLElement>(null);

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
      // Clipboard denied or unavailable (insecure context). Select the command instead,
      // so the keyboard copy still works rather than the button doing nothing.
      if (!code.current) return;
      const range = document.createRange();
      range.selectNodeContents(code.current);
      const selection = getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  };

  return (
    <Paper
      variant="outlined"
      sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 1.5, pr: 0.5, py: 0.5, width: 1 }}
    >
      <Typography
        ref={code}
        component="code"
        variant="body2"
        // Commands wrap rather than clip: a command the visitor cannot read in full is
        // worse than one on two lines.
        sx={{ flexGrow: 1, minWidth: 0, fontFamily: mono, overflowWrap: 'anywhere' }}
      >
        {value}
      </Typography>
      <Tooltip title={copied ? copy.copiedLabel : copy.copyLabel}>
        <IconButton onClick={write} aria-label={`${copy.copyLabel} ${value}`} sx={{ p: 1.5 }}>
          {copied ? (
            <CheckIcon fontSize="small" color="primary" />
          ) : (
            <ContentCopyIcon fontSize="small" />
          )}
        </IconButton>
      </Tooltip>
      <Box component="span" role="status" sx={srOnly}>
        {copied ? copy.copiedLabel : ''}
      </Box>
    </Paper>
  );
}
