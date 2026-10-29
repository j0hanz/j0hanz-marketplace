import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useRef } from 'react';
import { flushSync } from 'react-dom';
import Box from '@mui/material/Box';
import { clientName } from '../clients';
import { CloseIcon, ExternalIcon, InfoIcon, NoResultsIcon, SearchIcon } from '../icons';
import { ALL, type CatalogFilter } from '../hooks/useCatalogFilter';
import { type ClientId, countLabel, external, externalLabel, site, type Plugin } from '../site';
import { accent, drawable, edge, outline, segmented, srOnly, tag } from '../theme/tokens';
import { ClientPicker } from './ClientPicker';
import { Command } from './Command';
import { CountChips } from './CountChips';
import { RevealOnEnter } from './RevealOnEnter';
import { Section } from './Section';

const stretch = { '&::after': { content: '""', position: 'absolute', inset: 0 } };

function PluginCard({ plugin, client }: { plugin: Plugin; client: ClientId }) {
  const hooks = plugin.hookEvents.join(', ');
  const command = plugin.installs[client];
  return (
    <Card
      variant="outlined"
      data-lit
      sx={{
        height: 1,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        viewTransitionName: `card-${plugin.name}`,
        ...drawable('top', accent),
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}
        >
          <Typography variant="caption" color="textSecondary" sx={tag}>
            {plugin.category}
          </Typography>
          <Typography variant="caption" color="textSecondary" sx={{ ...tag, flexShrink: 0 }}>
            <Box component="span" sx={srOnly}>
              version{' '}
            </Box>
            {plugin.version}
          </Typography>
        </Stack>

        <Typography variant="h6" component="h3" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>
          <Link
            href={plugin.homepage}
            {...external}
            color="inherit"
            underline="hover"
            aria-label={externalLabel(`${plugin.displayName} homepage`)}
            sx={stretch}
          >
            {plugin.displayName}
            <ExternalIcon />
          </Link>
        </Typography>

        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
          {plugin.summary}
        </Typography>

        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          sx={{ flexWrap: 'wrap', mt: 2, position: 'relative' }}
        >
          <CountChips plugin={plugin} />
          {plugin.hookEvents.length > 0 && (
            <Tooltip title={hooks}>
              <Chip
                size="small"
                variant="outlined"
                tabIndex={0}
                icon={<InfoIcon />}
                label={countLabel(plugin.hookEvents.length, 'hook')}
                aria-label={`${countLabel(plugin.hookEvents.length, 'hook')}: ${hooks}`}
              />
            </Tooltip>
          )}
        </Stack>
      </CardContent>

      <CardActions disableSpacing sx={{ position: 'relative', flexDirection: 'column' }}>
        {/* Kept on the page rather than filtered out: a plugin the chosen client cannot
            run is still worth knowing about, and the dashed bar holds the command's place. */}
        {command ? (
          <Command value={command} />
        ) : (
          <Typography
            variant="caption"
            color="textSecondary"
            sx={{ alignSelf: 'stretch', px: 1.5, py: 1.5, border: `1px dashed ${edge}` }}
          >
            Not available in {clientName(client)}
          </Typography>
        )}
      </CardActions>
    </Card>
  );
}

export function Catalog({
  filter,
  client,
  onClient,
}: {
  filter: CatalogFilter;
  client: ClientId;
  onClient: (next: ClientId) => void;
}) {
  const { visible, category, setCategory, query, setQuery, reset } = filter;
  const searchInput = useRef<HTMLInputElement>(null);
  const pickCategory = (next: string) => {
    if (!document.startViewTransition) {
      setCategory(next);
      return;
    }
    document.startViewTransition(() => flushSync(() => setCategory(next))).ready.catch(() => {});
  };

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
          inputRef={searchInput}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && (query || category !== ALL)) {
              reset();
              e.preventDefault();
            }
          }}
          placeholder="skill, agent, hook, or MCP server"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: query ? (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    edge="end"
                    aria-label="Clear search"
                    onClick={() => {
                      setQuery('');
                      searchInput.current?.focus();
                    }}
                  >
                    <CloseIcon fontSize="small" data-swap-in="" />
                  </IconButton>
                </InputAdornment>
              ) : undefined,
            },
            htmlInput: {
              autoComplete: 'off',
              spellCheck: false,
              inputMode: 'search',
            },
          }}
          sx={{ width: 1, maxWidth: { md: 320 } }}
        />
        <Stack direction="row" useFlexGap spacing={2} sx={{ flexWrap: 'wrap' }}>
          {/* The same choice the hero panel makes, here too so a reader deep in the
              grid does not scroll back up to switch every card's command. */}
          <ClientPicker value={client} onChange={onClient} />
          <ToggleButtonGroup
            exclusive
            size="small"
            value={category}
            onChange={(_, next: string | null) => next && pickCategory(next)}
            aria-label="Filter plugins by category"
            sx={segmented}
          >
            <ToggleButton value={ALL}>All</ToggleButton>
            {site.categories.map((name) => (
              <ToggleButton key={name} value={name}>
                {name}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>
      </Stack>

      {visible.length === 0 ? (
        <Stack spacing={2} sx={{ py: 6, px: 3, alignItems: 'flex-start', border: outline }}>
          <NoResultsIcon fontSize="large" sx={{ color: 'text.secondary' }} aria-hidden />
          <Typography variant="body1" color="textSecondary">
            {query ? `No plugins match “${query}”.` : 'No plugins in this category.'}
          </Typography>
          <Link
            component="button"
            variant="body2"
            color="text.primary"
            onClick={reset}
            sx={{ py: 0.5 }}
          >
            {query && category !== ALL ? 'Clear search and category' : 'Show all plugins'}
          </Link>
        </Stack>
      ) : (
        <RevealOnEnter dep={visible.length}>
          <Grid container spacing={3}>
            {visible.map((plugin) => (
              <Grid key={plugin.name} size={{ xs: 12, sm: 6, lg: 4 }} data-reveal>
                <PluginCard plugin={plugin} client={client} />
              </Grid>
            ))}
          </Grid>
        </RevealOnEnter>
      )}
    </Section>
  );
}
