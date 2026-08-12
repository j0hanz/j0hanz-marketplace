export const mono =
  "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

export const sans =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const steelVar = 'var(--mui-palette-steel)';
export const edge = 'var(--mui-palette-edge)';
export const accent = 'var(--mui-palette-primary-main)';

export const RULE_WIDTH = 3;

/** Structural frame: nav, footer, section headers, skip link, menu paper, panels. */
export const rule = `${RULE_WIDTH}px solid ${steelVar}`;

/** Object outline: cards, command bars, anything sitting inside a frame. */
export const outline = `1px solid ${edge}`;

/** Amber edge marking a frame as live: current section, selected filter, open row. */
const LIT_OFFSET = {
  top: `0 ${RULE_WIDTH}px`,
  bottom: `0 -${RULE_WIDTH}px`,
  left: `${RULE_WIDTH}px 0`,
} as const;

export const lit = (side: keyof typeof LIT_OFFSET) => `inset ${LIT_OFFSET[side]} 0 0 ${accent}`;

/**
 * The same bar in transparent, so a control that can become live reserves the
 * geometry while resting and interpolates the colour instead of snapping it in.
 */
export const litIdle = (side: keyof typeof LIT_OFFSET) =>
  `inset ${LIT_OFFSET[side]} 0 0 transparent`;

/** What it means to be the current section, the selected filter, the open row. */
export const activeSx = (side: keyof typeof LIT_OFFSET) => ({
  color: 'var(--mui-palette-text-primary)',
  fontWeight: 700,
  boxShadow: lit(side),
});

/**
 * Geometry for a structural rule that motion can draw in; index.css owns the
 * timing and the states. Undrawn is not the default, so no-JS, print, and
 * reduced-motion keep the frame. The caller owns positioning: the element must
 * establish a containing block.
 */
export const drawable = (side: 'top' | 'bottom', color = steelVar) => ({
  '&::after': {
    content: '""',
    position: 'absolute',
    [side]: 0,
    insetInline: 0,
    height: RULE_WIDTH,
    bgcolor: color,
    transformOrigin: 'left',
  },
});

export const ground = { light: '#EDF0F3', dark: '#0E1116' } as const;
export const ink = { light: '#0E1116', dark: '#E7EBF0' } as const;
export const brand = { light: '#B45309', dark: '#F5A524' } as const;
export const paper = { light: '#FFFFFF', dark: '#171C23' } as const;
export const steel = { light: '#4A5568', dark: '#68758A' } as const;

export const scrollOffset = 80;

export const codeSx = { fontFamily: mono, overflowWrap: 'anywhere' } as const;

/**
 * Metadata voice. A chip counts things — skills, agents, hooks — and nothing
 * else; anything that names a thing instead (category, version, kind of entry)
 * is set in this. Two classes, so a version stops reading as a fourth count.
 */
export const tag = {
  fontFamily: mono,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
} as const;

export const srOnly = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
} as const;

export const focusRing = {
  outline: '2px solid var(--focus-ring)',
  outlineOffset: '2px',
};
