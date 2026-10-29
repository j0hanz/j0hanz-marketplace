import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { drawable, mono, srOnly } from '../theme/tokens';
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
              sx={{ color: 'text.secondary', fontFamily: mono, fontSize: '1rem' }}
            >
              {/* A role-less span drops its aria-label, so the label is text. */}
              <span aria-hidden>{count.total}</span>
              <Box component="span" sx={srOnly}>
                {count.label}
              </Box>
            </Box>
          )}
        </Stack>
      </RevealOnEnter>
      {children}
    </Container>
  );
}
