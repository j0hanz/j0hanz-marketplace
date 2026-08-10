import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import InputAdornment from '@mui/material/InputAdornment';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { memo, useRef } from 'react';
import { ExternalIcon, InfoIcon, SearchIcon } from '../icons';
import { ALL, useCatalogFilter } from '../hooks/useCatalogFilter';
import { useEnter } from '../hooks/useEnter';
import { relay } from '../motion';
import { countLabel, site, type Plugin } from '../site';
import { accent, drawable, outline } from '../theme/tokens';
import { Command } from './Command';
import { Section } from './Section';

const PluginCard = memo(function PluginCard({ plugin }: { plugin: Plugin }) {
  return (
    <Card
      variant="outlined"
      data-lit
      sx={{
        height: 1,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        // Named per plugin so a card surviving the filter travels to its new
        // cell instead of cross-fading in place.
        viewTransitionName: `card-${plugin.name}`,
        ...drawable('top', accent),
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
              // Overrides ExternalIcon's own phrasing, so it repeats the warning.
              aria-label={`${plugin.displayName} homepage (opens in a new tab)`}
            >
              {plugin.displayName}
              <ExternalIcon />
            </Link>
          </Typography>
          <Chip label={plugin.version} size="small" variant="outlined" sx={{ flexShrink: 0 }} />
        </Stack>

        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
          {plugin.summary}
        </Typography>

        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mt: 2 }}>
          {plugin.skills.length > 0 && (
            <Chip
              size="small"
              variant="outlined"
              label={countLabel(plugin.skills.length, 'skill')}
            />
          )}
          {plugin.agents.length > 0 && (
            <Chip
              size="small"
              variant="outlined"
              label={countLabel(plugin.agents.length, 'agent')}
            />
          )}
          {plugin.hookEvents.length > 0 && (
            <Tooltip title={plugin.hookEvents.join(', ')}>
              <Chip
                size="small"
                variant="outlined"
                tabIndex={0}
                icon={<InfoIcon />}
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
});

export function Catalog() {
  const { visible, category, setCategory, query, setQuery, reset } = useCatalogFilter();
  const grid = useRef<HTMLDivElement>(null);
  // Cards below the fold still reveal on scroll; ones a filter puts back land
  // without it. See useEnter.
  useEnter(grid, visible);

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
          label="Search plugins"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && query) {
              setQuery('');
              e.preventDefault();
            }
          }}
          placeholder="skill, agent, or hook name"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
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
          onChange={(_, next: string | null) => next && relay(() => setCategory(next))}
          aria-label="Filter plugins by category"
          sx={{
            flexWrap: 'wrap',
            gap: '3px',
            '& .MuiToggleButton-root': { minHeight: 44, px: 1.5 },
            // Wrapped rows can't share edges, so give every button its own.
            '& .MuiToggleButtonGroup-grouped:not(:first-of-type)': {
              ml: 0,
              borderLeft: outline,
            },
          }}
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
        <Stack data-settle spacing={1} sx={{ py: 6, alignItems: 'flex-start' }}>
          <Typography variant="body1" color="textSecondary">
            {query ? `No plugins match “${query}”.` : 'No plugins in this category.'}
          </Typography>
          {/* Not relayed: `reset` clears the query too, and `visible` reads a
              deferred copy of it that no synchronous flush can advance. */}
          <Link component="button" variant="body2" color="text.primary" onClick={reset}>
            {query && category !== ALL ? 'Clear search and category' : 'Show all plugins'}
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
