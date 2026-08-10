import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { countLabel, site, type Plugin } from '../site';
import { ALL, useCatalogFilter } from '../hooks/useCatalogFilter';
import { useGridFlip } from '../hooks/useGridFlip';
import { Command } from './Command';
import { PluginCountChips } from './PluginCountChips';
import { Section } from './Section';

const SEARCH_HINT = 'Search plugins, skills, agents…';

const litEdge = {
  boxShadow: 'inset 0 3px 0 0 var(--mui-palette-primary-main)',
};

function PluginCard({ plugin }: { plugin: Plugin }) {
  return (
    <Card
      variant="outlined"
      sx={{
        height: 1,
        display: 'flex',
        flexDirection: 'column',
        '&:focus-within': litEdge,
        '@media (hover: hover) and (pointer: fine)': { '&:hover': litEdge },
        transition: 'box-shadow 200ms ease',
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Typography variant="h6" component="h3" sx={{ overflowWrap: 'anywhere' }}>
            <Link
              href={plugin.homepage}
              target="_blank"
              rel="noreferrer"
              color="inherit"
              underline="hover"
              aria-label={`${plugin.displayName} homepage`}
            >
              {plugin.displayName}
            </Link>
          </Typography>
          <Chip label={plugin.version} size="small" variant="outlined" sx={{ flexShrink: 0 }} />
        </Stack>

        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
          {plugin.summary}
        </Typography>

        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mt: 2 }}>
          <PluginCountChips plugin={plugin} />
          {plugin.hookEvents.length > 0 && (
            <Tooltip title={plugin.hookEvents.join(', ')}>
              <Chip
                size="small"
                variant="outlined"
                tabIndex={0}
                label={countLabel(plugin.hookEvents.length, 'hook')}
              />
            </Tooltip>
          )}
        </Stack>
      </CardContent>

      <CardActions>
        <Command value={plugin.installCommand} />
      </CardActions>
    </Card>
  );
}

export function Catalog() {
  const { visible, category, setCategory, query, setQuery, reset } = useCatalogFilter();
  const grid = useGridFlip(visible);

  return (
    <Section
      id="plugins"
      title="Plugins"
      count={{ total: visible.length, label: countLabel(visible.length, 'plugin') }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        sx={{ mb: 4, alignItems: { md: 'center' }, justifyContent: 'space-between' }}
      >
        <TextField
          type="search"
          label="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && query) {
              setQuery('');
              e.preventDefault();
            }
          }}
          placeholder={SEARCH_HINT}
          slotProps={{
            htmlInput: {
              autoComplete: 'off',
              spellCheck: false,
              inputMode: 'search',
            },
          }}
          sx={{ width: 1, maxWidth: { md: 320 } }}
        />
        <ToggleButtonGroup
          exclusive
          size="small"
          value={category}
          onChange={(_, next: string | null) => next && setCategory(next)}
          aria-label="Filter plugins by category"
          sx={{ flexWrap: 'wrap', '& .MuiToggleButton-root': { minHeight: 44, px: 1.5 } }}
        >
          <ToggleButton value={ALL}>All</ToggleButton>
          {site.categories.map((name) => (
            <ToggleButton key={name} value={name}>
              {name}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      {visible.length === 0 ? (
        <Stack spacing={1} sx={{ py: 6, alignItems: 'flex-start' }}>
          <Typography variant="body1" color="textSecondary">
            No plugins match this search.
          </Typography>
          <Link component="button" variant="body2" color="text.primary" onClick={reset}>
            Clear filters
          </Link>
        </Stack>
      ) : (
        <Grid container spacing={3} ref={grid}>
          {visible.map((plugin) => (
            <Grid key={plugin.name} size={{ xs: 12, sm: 6, lg: 4 }} data-reveal>
              <PluginCard plugin={plugin} />
            </Grid>
          ))}
        </Grid>
      )}
    </Section>
  );
}
