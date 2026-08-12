import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useRef } from 'react';
import { ExternalIcon, MarkIcon } from '../icons';
import { useEnter } from '../hooks/useEnter';
import { site } from '../site';

const hitArea = { py: 0.3 };

export function Footer() {
  const footer = useRef<HTMLElement>(null);
  useEnter(footer);

  return (
    <Box component="footer" ref={footer} data-draw sx={{ py: 3, position: 'relative' }}>
      <Container maxWidth="lg">
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={{ xs: 1, sm: 2 }}
          sx={{ justifyContent: 'space-between', alignItems: { sm: 'baseline' } }}
        >
          <Stack direction="row" spacing={2} sx={{ alignItems: 'baseline' }}>
            {/* Inline rather than a flex row: the Stack aligns on baselines, and
                a flex Typography would hand it the icon's instead. */}
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              <MarkIcon sx={{ fontSize: '1.15em', mr: 0.75, verticalAlign: '-0.2em' }} />
              {site.name}
            </Typography>
            <Link
              href={`${site.repoUrl}/blob/main/LICENSE`}
              target="_blank"
              rel="noreferrer"
              variant="caption"
              color="text.secondary"
              underline="hover"
              sx={hitArea}
            >
              MIT license
              <ExternalIcon />
            </Link>
          </Stack>
          <Link
            href={site.repoUrl}
            target="_blank"
            rel="noreferrer"
            variant="body2"
            color="text.secondary"
            underline="hover"
            sx={hitArea}
          >
            {site.repo}
            <ExternalIcon />
          </Link>
        </Stack>
      </Container>
    </Box>
  );
}
