import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

/** The page's one section shell: anchor, heading, optional count, vertical rhythm. */
export function Section({
  id,
  title,
  count,
  children,
}: {
  id: string;
  title: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <Container component="section" id={id} maxWidth="lg" sx={{ py: { xs: 6, md: 9 } }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: { xs: 3, md: 4 } }}>
        <Typography variant="h4" component="h2" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        {count !== undefined && <Chip label={count} size="small" />}
      </Stack>
      {children}
    </Container>
  );
}
