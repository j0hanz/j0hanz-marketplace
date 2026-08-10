import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import { CheckIcon, ContentCopyIcon } from '../icons';
import { codeSx, srOnly } from '../theme/tokens';

export function Command({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  const tip = copied ? 'Copied' : 'Copy';
  const Icon = copied ? CheckIcon : ContentCopyIcon;

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
            await navigator.clipboard.writeText(value);
            setCopied(true);
          }}
          aria-label={`Copy ${value}`}
          sx={{ p: 1.5 }}
        >
          <Icon fontSize="small" color={copied ? 'primary' : undefined} />
        </IconButton>
      </Tooltip>
      {/* Idle says nothing: the button already carries its own label. */}
      <Box component="span" role="status" sx={srOnly}>
        {copied ? tip : ''}
      </Box>
    </Paper>
  );
}
