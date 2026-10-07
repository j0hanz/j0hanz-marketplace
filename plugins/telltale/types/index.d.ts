export type View = 'calls' | 'detail' | 'inventory';
export type NextAction =
  'pending' | 'aborted' | 'answered' | 'retried' | 'asked-user' | 'other-tool';
export type Call = {
  id: string; // tool_use_id
  tool: string;
  server: string | null; // MCP server, null for built-in tools
  agentId: string | null;
  response: number | null; // index of the issuing response within its agent's list
  ms: number;
  args: string; // JSON of the arguments, unredacted, first 20,000 chars (R25, R20)
  argsChars: number;
  text: string; // what Claude read, unredacted, first 20,000 chars
  textChars: number;
  isError: boolean;
  next: NextAction | null; // null until the turn ends
  used: string[]; // R13
};
export type InventoryRow = {
  group: string;
  name: string;
  tokens: number;
  measured: boolean;
  state?: 'loaded' | 'deferred';
};
export type Inventory = {
  rows: InventoryRow[];
  status: 'idle' | 'measuring' | 'unavailable' | string;
}; // a string status is a `measure failed: …` line

declare module 'claude-code' {
  interface PluginState {
    telltale: {
      calls: Call[];
      dropped: number; // calls evicted past 200 (R25)
      view: View;
      selected: string | null;
      inventory: Inventory;
      folder: string; // absolute log folder for this session ('' until session start)
    };
  }
}
