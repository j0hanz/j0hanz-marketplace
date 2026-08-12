import Box from '@mui/material/Box';
import { rule } from '../theme/tokens';

const sx = {
  position: 'fixed',
  top: 8,
  left: 8,
  zIndex: 'tooltip',
  px: 2,
  py: 1,
  bgcolor: 'background.paper',
  color: 'text.primary',
  border: rule,
  textDecoration: 'none',
  transform: 'translateY(-300%)',
  transition: 'transform 150ms var(--ease-out)',
  '&:focus-visible': { transform: 'none' },
} as const;

export function SkipLink() {
  return (
    <Box component="a" href="#main" sx={sx}>
      Skip to content
    </Box>
  );
}
