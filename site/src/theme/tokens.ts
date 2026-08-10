export const mono = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

export const sans =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export const steel = 'var(--mui-palette-steel)';

export const ground = { light: '#EDF0F3', dark: '#0E1116' } as const;

export const scrollOffset = 80;

export const codeSx = { fontFamily: mono, overflowWrap: 'anywhere' } as const;

export const srOnly = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
} as const;

export const heading = (min: string, max: string, letterSpacing: string) => ({
  fontFamily: mono,
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing,
  lineHeight: 1.1,
  fontSize: `clamp(${min}, 5vw, ${max})`,
  textWrap: 'balance' as const,
});

export const focusRing = {
  outline: '2px solid var(--focus-ring)',
  outlineOffset: '2px',
};
