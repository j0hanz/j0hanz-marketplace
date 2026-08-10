import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useRef } from 'react';
import { useEnter } from '../hooks/useEnter';
import { site } from '../site';
import { accent, drawable, rule } from '../theme/tokens';

export function Footer() {
  const footer = useRef<HTMLElement>(null);
  useEnter(footer);

  return (
    <Box
      component="footer"
      ref={footer}
      data-draw
      sx={{ borderTop: rule, py: 5, position: 'relative', ...drawable('top', accent) }}
    >
      <Container maxWidth="lg">
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={{ xs: 1, sm: 2 }}
          sx={{ justifyContent: 'space-between', alignItems: { sm: 'baseline' } }}
        >
          <Stack direction="row" spacing={2} sx={{ alignItems: 'baseline' }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {site.name}
            </Typography>
            <Link
              href={`${site.repoUrl}/blob/main/LICENSE`}
              target="_blank"
              rel="noreferrer"
              variant="caption"
              color="text.secondary"
              underline="hover"
            >
              MIT license
            </Link>
          </Stack>
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
