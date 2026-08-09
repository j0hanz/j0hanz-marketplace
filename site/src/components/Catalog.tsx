import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { copy } from '../copy';
import { site } from '../site';
import { Command } from './Command';
import { PluginCountChips } from './PluginCountChips';
import { Section } from './Section';

const ALL = 'all';

export function Catalog() {
  const [category, setCategory] = useState<string>(ALL);
  const visible =
    category === ALL ? site.plugins : site.plugins.filter((p) => p.category === category);

  return (
    <Section id="plugins" title={copy.catalogTitle} count={visible.length}>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={category}
        onChange={(_, next: string | null) => next && setCategory(next)}
        aria-label={copy.catalogTitle}
        sx={{ mb: 4, flexWrap: 'wrap', '& .MuiToggleButton-root': { minHeight: 44 } }}
      >
        <ToggleButton value={ALL}>{copy.catalogAll}</ToggleButton>
        {site.categories.map((name) => (
          <ToggleButton key={name} value={name}>
            {name}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <Grid container spacing={3}>
        {visible.map((p) => (
          <Grid key={p.name} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card variant="outlined" sx={{ height: 1, display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <Typography variant="h6" component="h3" sx={{ overflowWrap: 'anywhere' }}>
                    <Link
                      href={p.homepage}
                      target="_blank"
                      rel="noreferrer"
                      color="inherit"
                      underline="hover"
                    >
                      {p.displayName}
                    </Link>
                  </Typography>
                  <Chip label={p.version} size="small" variant="outlined" sx={{ flexShrink: 0 }} />
                </Stack>

                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {p.summary}
                </Typography>

                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mt: 2 }}>
                  <PluginCountChips plugin={p} />
                  {p.hookEvents.map((event) => (
                    <Chip key={event} size="small" variant="outlined" label={event} />
                  ))}
                </Stack>
              </CardContent>

              <CardActions>
                <Command value={p.installCommand} />
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Section>
  );
}
