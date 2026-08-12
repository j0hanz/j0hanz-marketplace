import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { useRef } from 'react';
import { useEnter } from '../hooks/useEnter';
import { drawable } from '../theme/tokens';

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
  // Scoped to the header alone: the section's children own their own reveals,
  // and a Container-wide scope would observe them a second time.
  const header = useRef<HTMLDivElement>(null);
  useEnter(header);
  return (
    <Container
      component="section"
      id={id}
      aria-labelledby={`${id}-title`}
      maxWidth="lg"
      sx={{ py: { xs: 6, md: 7 } }}
    >
      <Stack
        ref={header}
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
      {children}
    </Container>
  );
}
