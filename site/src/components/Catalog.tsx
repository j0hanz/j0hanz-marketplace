import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useEffect, useMemo, useRef, useState } from 'react';
import { copy } from '../copy';
import { site, type Plugin } from '../site';
import { Command } from './Command';
import { PluginCountChips } from './PluginCountChips';
import { Section } from './Section';

const ALL = 'all';

// Precompute the search haystack once per plugin so a keystroke is O(plugins),
// not O(plugins × haystack length) for every category change. Hook events are
// included so a visitor searching "PreToolUse" finds the CSS plugin, not silence.
const haystackFor = (p: Plugin) =>
  [
    p.displayName,
    p.summary,
    p.hookEvents.join(' '),
    ...p.skills.map((s) => s.name + ' ' + s.description),
    ...p.agents.map((a) => a.name + ' ' + a.description),
  ]
    .join(' ')
    .toLowerCase();

export function Catalog() {
  const [category, setCategory] = useState<string>(ALL);
  const [query, setQuery] = useState<string>('');
  const [debounced, setDebounced] = useState<string>('');

  // URL hash sync: ?cat=<name> or #plugins — back/forward restores the filter.
  const didInit = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const initial = params.get('cat');
    if (initial) setCategory(initial);
  }, []);

  useEffect(() => {
    if (!didInit.current) {
      didInit.current = true;
      return;
    }
    const params = new URLSearchParams(location.search);
    if (category === ALL) {
      params.delete('cat');
    } else {
      params.set('cat', category);
    }
    const next = `${location.pathname}${params.toString() ? `?${params}` : ''}${location.hash}`;
    if (next !== location.pathname + location.search + location.hash) {
      history.replaceState(null, '', next);
    }
  }, [category]);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim().toLowerCase()), 150);
    return () => clearTimeout(timer);
  }, [query]);

  const visible = useMemo(() => {
    const byCategory =
      category === ALL ? site.plugins : site.plugins.filter((p) => p.category === category);
    if (!debounced) return byCategory;
    return byCategory.filter((p) => haystackFor(p).includes(debounced));
  }, [category, debounced]);

  return (
    <Section id="plugins" title={copy.catalogTitle} count={visible.length}>
      <Stack spacing={2} sx={{ mb: 4 }}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && query) {
              setQuery('');
              e.preventDefault();
            }
          }}
          placeholder={copy.catalogSearch}
          aria-label={copy.catalogSearch}
          autoComplete="off"
          spellCheck={false}
          inputMode="search"
          style={{
            font: 'inherit',
            padding: '10px 12px',
            border: '1px solid var(--mui-palette-divider)',
            background: 'var(--mui-palette-background-paper)',
            color: 'var(--mui-palette-text-primary)',
            maxWidth: 360,
          }}
        />
        <ToggleButtonGroup
          exclusive
          size="small"
          value={category}
          onChange={(_, next: string | null) => next && setCategory(next)}
          aria-label={copy.catalogTitle}
          sx={{ flexWrap: 'wrap', '& .MuiToggleButton-root': { minHeight: 44 } }}
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
          <Typography variant="body1" color="text.secondary">
            {copy.catalogEmpty}
          </Typography>
          <Typography
            component="button"
            variant="body2"
            onClick={() => {
              setQuery('');
              setCategory(ALL);
            }}
            sx={{
              font: 'inherit',
              background: 'none',
              border: 0,
              color: 'primary.main',
              cursor: 'pointer',
              p: 0,
              textDecoration: 'underline',
            }}
          >
            {copy.catalogClear}
          </Typography>
        </Stack>
      ) : (
        <Grid container spacing={3}>
          {visible.map((p) => (
            <Grid key={p.name} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card
                variant="outlined"
                sx={{
                  height: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  // Outlined cards give no sign they are anything but a box. The edge lights
                  // up amber under the cursor or when a child has focus, matching the nav and
                  // the hero bezel. :focus-within keeps the affordance for keyboard users
                  // without adding a new tab stop on the card itself.
                  '&:hover, &:focus-within': {
                    borderColor: 'primary.main',
                    transform: 'translateY(-2px)',
                  },
                  '@media (prefers-reduced-motion: no-preference)': {
                    transition: 'border-color 200ms ease, transform 200ms ease',
                  },
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
                        href={p.homepage}
                        target="_blank"
                        rel="noreferrer"
                        color="inherit"
                        underline="hover"
                        aria-label={`${p.displayName} homepage`}
                      >
                        {p.displayName}
                      </Link>
                    </Typography>
                    <Chip
                      label={p.version}
                      size="small"
                      variant="outlined"
                      sx={{ flexShrink: 0 }}
                    />
                  </Stack>

                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {p.summary}
                  </Typography>

                  <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mt: 2 }}>
                    <PluginCountChips plugin={p} />
                    {p.hookEvents.length > 0 && (
                      <Tooltip title={p.hookEvents.join(', ')} enterDelay={400} enterNextDelay={0}>
                        <Chip
                          size="small"
                          variant="outlined"
                          tabIndex={0}
                          label={`${p.hookEvents.length} ${p.hookEvents.length === 1 ? 'hook' : 'hooks'}`}
                        />
                      </Tooltip>
                    )}
                  </Stack>
                </CardContent>

                <CardActions>
                  <Command value={p.installCommand} />
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Section>
  );
}
