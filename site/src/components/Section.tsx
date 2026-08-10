import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { useRef } from 'react';
import { useReveal } from '../motion';
import { srOnly, steel } from '../theme/tokens';

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
  const scope = useRef<HTMLElement>(null);
  useReveal(':scope > [data-reveal]', {}, scope);
  return (
    <Container
      component="section"
      id={id}
      aria-labelledby={`${id}-title`}
      ref={scope}
      maxWidth="lg"
      sx={{ py: { xs: 7, md: 11 } }}
    >
      <Stack
        direction="row"
        spacing={2}
        data-reveal
        sx={{
          alignItems: 'baseline',
          mb: { xs: 4, md: 5 },
          pb: 1.5,
          borderBottom: `3px solid ${steel}`,
        }}
      >
        <Typography id={`${id}-title`} variant="h4" component="h2" sx={{ flexGrow: 1 }}>
          {title}
        </Typography>
        {count && (
          <>
            <Chip label={count.total} size="small" aria-hidden />
            <Box component="span" role="status" sx={srOnly}>
              {count.label}
            </Box>
          </>
        )}
      </Stack>
      {children}
    </Container>
  );
}
