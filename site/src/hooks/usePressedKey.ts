import { useState } from 'react';

// Gates an icon-swap animation on first user press. The page mounts with several
// of these showing, and only a real interaction should re-key the icon.
export function usePressedKey() {
  const [key, setKey] = useState(0);
  const press = () => setKey((n) => n + 1);
  return { key, pressed: key || undefined, press };
}
