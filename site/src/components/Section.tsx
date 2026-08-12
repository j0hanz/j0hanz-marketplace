import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { drawable } from '../theme/tokens';
import { RevealOnEnter } from './RevealOnEnter';

export function Section({
  id,
  title,
  count,
  children,
}: {
  id: string;
  title: string;
  count?: { total: number; label: string };
  children: ReactNode;
}) {
  return (
    <Container
      component="section"
      id={id}
      aria-labelledby={`${id}-title`}
      maxWidth="lg"
      sx={{ py: { xs: 6, md: 7 } }}
    >
      <RevealOnEnter>
        <Stack
          direction="row"
          spacing={2}
          data-draw
          sx={{
            alignItems: 'baseline',
            mb: { xs: 4, md: 5 },
            pb: 1.5,
            position: 'relative',
            ...drawable('bottom'),
          }}
        >
          <Typography id={`${id}-title`} variant="h4" component="h2" sx={{ flexGrow: 1 }}>
            {title}
          </Typography>
          {count && (
            <Box
              component="span"
              aria-label={count.label}
              sx={{
                px: 1,
                py: 0.25,
                border: 1,
                borderColor: 'divider',
                fontFamily: 'var(--mui-font-family-mono, monospace)',
                fontSize: '0.75rem',
                lineHeight: 1.6,
              }}
            >
              {count.total}
            </Box>
          )}
        </Stack>
      </RevealOnEnter>
      {children}
    </Container>
  );
}
