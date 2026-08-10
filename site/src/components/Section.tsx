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
  /**
   * The count chip: the number shown, and what it counts for anyone who cannot see it.
   * The label travels with the number because the heading is not a noun it can be derived
   * from — "Plugins" mis-announces as "1 plugins", and the skills index counts two things.
   */
  count?: { total: number; label: string };
  children: ReactNode;
}) {
  return (
    <Container
      component="section"
      id={id}
      aria-labelledby={`${id}-title`}
      maxWidth="lg"
      sx={{ py: { xs: 6, md: 9 } }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: { xs: 3, md: 4 } }}>
        <Typography id={`${id}-title`} variant="h4" component="h2">
          {title}
        </Typography>
        {count && <Chip label={count.total} size="small" aria-label={count.label} />}
      </Stack>
      {children}
    </Container>
  );
}
