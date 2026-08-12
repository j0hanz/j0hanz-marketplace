import { useState } from 'react';

// Gates an icon-swap animation on first user press. The page mounts with several
// of these showing, and only a real interaction should re-key the icon.
export function usePressedKey() {
  const [pressed, setPressed] = useState(0);
  const press = () => setPressed((n) => n + 1);
  return { key: pressed, pressed: pressed || undefined, press } as const;
}
