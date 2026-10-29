import { useState } from 'react';
import { CLIENTS } from '../clients';
import type { ClientId } from '../site';

const KEY = 'client';
const DEFAULT = CLIENTS[0]?.id ?? 'claude';

// Remembered per visitor, so someone who installs with Copilot is not handed Claude
// commands on every return. Storage can be blocked or throw; the default stands then.
const stored = (): ClientId => {
  try {
    const value = localStorage.getItem(KEY);
    return CLIENTS.find((client) => client.id === value)?.id ?? DEFAULT;
  } catch {
    return DEFAULT;
  }
};

export function useClient() {
  const [client, setClient] = useState(stored);
  const choose = (next: ClientId) => {
    setClient(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Not remembered this time; the choice still holds for the visit.
    }
  };
  return [client, choose] as const;
}
