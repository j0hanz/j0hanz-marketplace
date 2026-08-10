import { flushSync } from 'react-dom';

/**
 * Runs a state change inside a view transition. For changes worth carrying —
 * a relayed grid, a flipped colour scheme — not per-keystroke ones. Without the
 * API, or without `data-motion`, the change just happens.
 */
export function relay(change: () => void) {
  if (!document.startViewTransition || !document.documentElement.dataset.motion) {
    change();
    return;
  }
  // A second press before the first settles skips it — latest wins, which is
  // right, but the skip rejects `ready` and that is not an error to report.
  document.startViewTransition(() => flushSync(change)).ready.catch(() => {});
}
