import type { SvgIconProps } from '@mui/material/SvgIcon';
import type { ComponentType } from 'react';
import { AntigravityIcon, ClaudeCodeIcon, CopilotIcon } from './icons';
import type { ClientId } from './site';

interface Client {
  id: ClientId;
  /** What the icon stands for: the picker's accessible name and its tooltip. */
  name: string;
  Icon: ComponentType<SvgIconProps>;
}

/** Picker order. The first is the default, and the one every plugin installs in. */
export const CLIENTS: readonly Client[] = [
  { id: 'claude', name: 'Claude Code', Icon: ClaudeCodeIcon },
  { id: 'copilot', name: 'GitHub Copilot CLI', Icon: CopilotIcon },
  { id: 'antigravity', name: 'Antigravity CLI', Icon: AntigravityIcon },
];

export const clientName = (id: ClientId) => CLIENTS.find((client) => client.id === id)?.name ?? id;
