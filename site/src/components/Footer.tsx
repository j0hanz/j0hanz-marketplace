import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { copy } from '../copy';
import { site } from '../site';

export function Footer() {
  return (
    <Box component="footer" sx={{ borderTop: 1, borderColor: 'divider', py: 4 }}>
      <Container maxWidth="lg">
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}
        >
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {site.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {copy.footerNote}
          </Typography>
          <Link
            href={site.repoUrl}
            target="_blank"
            rel="noreferrer"
            variant="body2"
            color="text.secondary"
            underline="hover"
          >
            {site.repo}
          </Link>
        </Stack>
      </Container>
    </Box>
  );
}
