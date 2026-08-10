import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { srOnly, steel } from '../theme';

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
      sx={{ py: { xs: 7, md: 11 } }}
    >
      {/* The heading sits on a steel rule that spans the measure, so each section opens
          as a chapter rather than as one more paragraph in the same column. */}
      <Stack
        direction="row"
        spacing={2}
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
            {/* The chip is a div, and ARIA gives a plain div no name — the label was
                being dropped and the number announced bare. So the sentence lives in
                its own element, which is also the live region: filtering the catalog
                changed this number with nothing to hear it. */}
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
