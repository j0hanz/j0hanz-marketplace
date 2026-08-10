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
import { useEffect, useMemo, useState } from 'react';
import { copy, plural } from '../copy';
import { site } from '../site';
import type { Plugin } from '../site';
import { Command } from './Command';
import { PluginCountChips } from './PluginCountChips';
import { Section } from './Section';

const ALL = 'all';

/**
 * The lit card edge: amber border, amber rule across the top. One object because hover and
 * focus-within reach it through two different selectors.
 */
const litEdge = {
  borderColor: 'primary.main',
  boxShadow: 'inset 0 3px 0 0 var(--mui-palette-primary-main)',
};

// `site` is a static import, so the haystacks are joined and lowercased once at module load
// rather than on every keystroke. Hook events are in there too, so a visitor searching
// "PreToolUse" finds the css plugin instead of silence.
const searchIndex = site.plugins.map((plugin) => ({
  plugin,
  haystack: [
    plugin.displayName,
    plugin.summary,
    plugin.hookEvents.join(' '),
    ...plugin.skills.map((s) => s.name + ' ' + s.description),
    ...plugin.agents.map((a) => a.name + ' ' + a.description),
  ]
    .join(' ')
    .toLowerCase(),
}));

function PluginCard({ plugin }: { plugin: Plugin }) {
  return (
    <Card
      variant="outlined"
      sx={{
        height: 1,
        display: 'flex',
        flexDirection: 'column',
        // Outlined cards give no sign they are anything but a box. The edge lights up amber
        // under the cursor or when a child has focus, matching the nav and the hero bezel.
        // :focus-within keeps the affordance for keyboard users without adding a new tab
        // stop on the card itself. The top rule is an inset shadow, so lighting it costs
        // no reflow and the card keeps its 1px frame underneath.
        //
        // Lighting up is as far as it goes. The card is not a link — the title and the
        // copy button are — and lifting it off the page said otherwise, then did nothing
        // when the body was clicked.
        //
        // Hover is gated to devices that have one. A tap fires `:hover` and leaves it
        // fired: on a phone the last card touched kept the amber edge until something
        // else was tapped, marking a card that had not been selected and is not a link.
        '&:focus-within': litEdge,
        '@media (hover: hover) and (pointer: fine)': { '&:hover': litEdge },
        transition: 'border-color 200ms ease, box-shadow 200ms ease',
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
                label={plural(plugin.hookEvents.length, copy.unit.hook)}
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
  // ?cat=<name> makes a filtered catalog a shareable link. An unknown category would
  // otherwise select nothing and render the empty state over a blank search box.
  const [category, setCategory] = useState(() => {
    const initial = new URLSearchParams(location.search).get('cat');
    return initial && site.categories.includes(initial) ? initial : ALL;
  });
  const [query, setQuery] = useState('');

  // Write the filter back so the address bar stays copyable. `replaceState` only, so this
  // never stacks history entries a visitor has to press back through to leave the page.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (category === ALL) params.delete('cat');
    else params.set('cat', category);
    history.replaceState(
      null,
      '',
      `${location.pathname}${params.toString() ? `?${params}` : ''}${location.hash}`,
    );
  }, [category]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return searchIndex
      .filter(
        ({ plugin, haystack }) =>
          (category === ALL || plugin.category === category) &&
          (!needle || haystack.includes(needle)),
      )
      .map(({ plugin }) => plugin);
  }, [category, query]);

  // The count is a live region, and filtering runs on every keystroke: typing "mcp" would
  // send three announcements for one search. The number on screen still changes per
  // keystroke; only the spoken sentence waits for the typing to stop. Seeded with the
  // first render's label so the settle-on-mount writes the same string and says nothing.
  const [announced, setAnnounced] = useState(plural(visible.length, copy.unit.plugin));
  useEffect(() => {
    const next = plural(visible.length, copy.unit.plugin);
    const timer = setTimeout(() => setAnnounced(next), 400);
    return () => clearTimeout(timer);
  }, [visible]);

  return (
    <Section
      id="plugins"
      title={copy.catalogTitle}
      count={{ total: visible.length, label: announced }}
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
          placeholder={copy.catalogSearch}
          slotProps={{
            // Match the touch target the toggle row below sets for itself.
            input: { sx: { minHeight: 44 } },
            htmlInput: {
              'aria-label': copy.catalogSearch,
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
          aria-label={copy.catalogTitle}
          sx={{ flexWrap: 'wrap', '& .MuiToggleButton-root': { minHeight: 44, px: 1.5 } }}
        >
          <ToggleButton value={ALL}>{copy.catalogAll}</ToggleButton>
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
            {copy.catalogEmpty}
          </Typography>
          {/* Ink, not amber. This is the only way out of the empty state, and as the
              default link colour it was 2.8:1 on paper — the same failure the nav links
              were already moved off. */}
          <Link
            component="button"
            variant="body2"
            color="text.primary"
            onClick={() => {
              setQuery('');
              setCategory(ALL);
            }}
          >
            {copy.catalogClear}
          </Link>
        </Stack>
      ) : (
        // Three columns wait for `lg`. At `md` the container is 890px, which made each
        // card 265px — narrow enough to wrap an install command onto three lines and the
        // chip row onto two, in a grid that was mostly empty anyway.
        <Grid container spacing={3}>
          {visible.map((plugin) => (
            <Grid key={plugin.name} size={{ xs: 12, sm: 6, lg: 4 }}>
              <PluginCard plugin={plugin} />
            </Grid>
          ))}
        </Grid>
      )}
    </Section>
  );
}
