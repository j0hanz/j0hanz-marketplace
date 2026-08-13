import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Link from '@mui/material/Link';
import SvgIcon from '@mui/material/SvgIcon';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useRef } from 'react';
import { flushSync } from 'react-dom';
import Box from '@mui/material/Box';
import { CloseIcon, ExternalIcon, InfoIcon, SearchIcon } from '../icons';
import { ALL, type CatalogFilter } from '../hooks/useCatalogFilter';
import { countLabel, site, type Plugin } from '../site';
import { accent, drawable, outline, RULE_WIDTH, srOnly, tag } from '../theme/tokens';
import { Command } from './Command';
import { CountChips } from './CountChips';
import { RevealOnEnter } from './RevealOnEnter';
import { Section } from './Section';

const stretch = { '&::after': { content: '""', position: 'absolute', inset: 0 } };

function PluginCard({ plugin }: { plugin: Plugin }) {
  const hooks = plugin.hookEvents.join(', ');
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
            target="_blank"
            rel="noreferrer"
            color="inherit"
            underline="hover"
            aria-label={`${plugin.displayName} homepage (opens in a new tab)`}
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

      <CardActions sx={{ position: 'relative' }}>
        <Command value={plugin.installCommand} />
      </CardActions>
    </Card>
  );
}

export function Catalog({ filter }: { filter: CatalogFilter }) {
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
        <ToggleButtonGroup
          exclusive
          size="small"
          value={category}
          onChange={(_, next: string | null) => next && pickCategory(next)}
          aria-label="Filter plugins by category"
          sx={{
            flexWrap: 'wrap',
            gap: `${RULE_WIDTH}px`,
            '& .MuiToggleButton-root': { minHeight: 44, px: 1.5 },
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
        <Stack spacing={2} sx={{ py: 6, px: 3, alignItems: 'flex-start', border: outline }}>
          <SvgIcon fontSize="large" sx={{ color: 'text.secondary' }} aria-hidden>
            <path d="M3 3h14v14H3zm2 2v10h10V5zm4.59 3L5 7.41 6.41 6 11 10.59 13.59 8 15 9.41 12.41 12 15 14.59 13.59 16 11 13.41 8.41 16 7 14.59 9.59 12zm8.12 7.29 1.42-1.42-3-3-1.42 1.42z" />
          </SvgIcon>
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
                <PluginCard plugin={plugin} />
              </Grid>
            ))}
          </Grid>
        </RevealOnEnter>
      )}
    </Section>
  );
}
