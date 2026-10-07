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
  argsChars: number;
  textChars: number;
  isError: boolean;
  next: NextAction | null; // null until the turn ends
};
// R25: a listed call's text, kept in the mod's memory rather than in `$.state`.
export type CallDetail = {
  args: string; // JSON of the arguments, unredacted, first 20,000 chars (R25, R20)
  text: string; // what Claude read, unredacted, first 20,000 chars
  used: string[]; // R13, raw values
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
  status: 'idle' | 'measuring' | 'unavailable' | `measure failed: ${string}`;
};

declare module 'claude-code' {
  interface PluginState {
    telltale: {
      calls: Call[];
      dropped: number; // calls evicted past 200 (R25)
      view: View;
      selected: string | null;
      inventory: Inventory;
      folder: string; // absolute log folder for this session ('' until session start)
      warned: boolean; // R16: the write-failure notice was shown this session
      pending: Record<string, string>; // delta R12: pending call id -> agent id
    };
  }
}
