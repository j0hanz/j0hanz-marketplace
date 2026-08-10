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
import { useRef } from 'react';
import { Flip, ScrollTrigger, gsap, motionOk, useGSAP } from '../motion';
import { plural, site, type Plugin } from '../site';
import { ALL, useCatalogFilter } from '../hooks/useCatalogFilter';
import { Command } from './Command';
import { PluginCountChips } from './PluginCountChips';
import { Section } from './Section';

const SEARCH_LABEL = 'Search plugins, skills, agents…';

/** The lit card edge, reached through two different selectors. */
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
        // Lighting up is as far as it goes: the card is not a link — the title and the copy
        // button are — and lifting it off the page said otherwise. `:focus-within` keeps the
        // affordance for keyboards without adding a tab stop on the card itself.
        '&:focus-within': litEdge,
        // Hover is gated to devices that have one. A tap fires `:hover` and leaves it fired,
        // marking a card that was not selected and is not a link.
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
                label={plural(plugin.hookEvents.length, 'hook')}
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
  const grid = useRef<HTMLDivElement>(null);
  const before = useRef<ReturnType<typeof Flip.getState> | null>(null);
  const shown = useRef(visible);

  // Filtering re-flows the grid, and the cards that survive a filter jump to new cells with
  // nothing connecting where they were to where they went. FLIP is the one thing on this page
  // CSS cannot do: it needs the layout as it stood *before* React commits the new one.
  //
  // The measurement happens here, in the render body, which is the seam React does give —
  // `visible` is the new list but the DOM is still showing the old one, and nothing has been
  // committed yet. Keying it to the list identity rather than to the input handlers means it
  // reads layout only when the grid is actually about to change: the search field is deferred
  // (see useCatalogFilter), and measuring on each keystroke would have put a synchronous
  // layout read back on the path that defers exists to keep clear.
  if (shown.current !== visible) {
    shown.current = visible;
    before.current = grid.current && motionOk() ? Flip.getState(grid.current.children) : null;
  }

  useGSAP(
    () => {
      if (!before.current) return;
      Flip.from(before.current, {
        duration: 0.35,
        ease: 'power2.out',
        // Cards that leave are unmounted by React, so there is nothing left to animate out.
        // The survivors slide to their new cell; arrivals fade in where they land — including
        // a card returning to the grid, which comes back as a new node with no reveal of its
        // own left on it.
        onEnter: (cards) => gsap.fromTo(cards, { opacity: 0 }, { opacity: 1, duration: 0.3 }),
      });
      before.current = null;
      // The page-level reveal collected its targets once, at mount. Cards it registered and
      // React has since unmounted leave triggers pointing at detached nodes, which can never
      // fire and so are never cleared by their own `once`.
      for (const trigger of ScrollTrigger.getAll()) {
        if (trigger.trigger?.isConnected === false) trigger.kill();
      }
    },
    { dependencies: [visible] },
  );

  return (
    <Section
      id="plugins"
      title="Plugins"
      count={{ total: visible.length, label: plural(visible.length, 'plugin') }}
    >
      {/* Search and filter share a row from md up: two controls on one line read as one
          control surface, and the catalog starts a screen higher on a laptop. */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        sx={{ mb: 4, alignItems: { md: 'center' }, justifyContent: 'space-between' }}
      >
        <TextField
          type="search"
          size="small"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && query) {
              setQuery('');
              e.preventDefault();
            }
          }}
          placeholder={SEARCH_LABEL}
          slotProps={{
            // Match the touch target the toggle row below sets for itself.
            input: { sx: { minHeight: 44 } },
            htmlInput: {
              'aria-label': SEARCH_LABEL,
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
          aria-label="Plugins"
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
          {/* Ink, not amber: this is the only way out of the empty state, and as the default
              link colour it was 2.8:1 on paper. */}
          <Link component="button" variant="body2" color="text.primary" onClick={reset}>
            Clear filters
          </Link>
        </Stack>
      ) : (
        // Three columns wait for `lg`. At `md` the container is 890px, which made each card
        // 265px — narrow enough to wrap an install command onto three lines.
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
