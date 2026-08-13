import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ExternalIcon, MarkIcon } from '../icons';
import { external, site } from '../site';
import { RevealOnEnter } from './RevealOnEnter';

const hitArea = { py: 0.3 };

export function Footer() {
  return (
    <Box component="footer" sx={{ py: 3, position: 'relative' }}>
      <RevealOnEnter>
        <Container maxWidth="lg" data-draw>
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
                {...external}
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
              {...external}
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
      </RevealOnEnter>
    </Box>
  );
}
