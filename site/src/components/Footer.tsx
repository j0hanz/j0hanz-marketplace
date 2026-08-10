import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { site } from '../site';
import { steel } from '../theme/tokens';

export function Footer() {
  return (
    <Box
      component="footer"
      // Mirrors the nav: steel edge, amber inset. The page closes on the frame it opened on.
      sx={{
        borderTop: `3px solid ${steel}`,
        boxShadow: 'inset 0 3px 0 0 var(--mui-palette-primary-main)',
        py: 5,
      }}
    >
      <Container maxWidth="lg">
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}
        >
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {site.name}
          </Typography>
          <Typography variant="caption" color="textSecondary" component="span" title="MIT licensed">
            MIT
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
