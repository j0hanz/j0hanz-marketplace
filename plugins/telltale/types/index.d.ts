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
  turn: number; // R34: the number of the turn file the call's record goes to
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
  window: number | null; // R41: the context window the breakdown measures against
  measured: Record<string, number>; // R21, R47: the last `m` figures, by row id
};
// R26, R42: counts since session start or the last /clear, kept across a hot reload (R47).
export type ToolTotals = { calls: number; errors: number; tokens: number };
export type Totals = {
  calls: number;
  errors: number;
  tokens: number;
  skills: string[];
  ctx: number | null; // R26: Claude Code's share of the context window in use
  tools: Record<string, ToolTotals>; // by full tool name
};
// R29: counted calls in flight, by tool_use_id.
export type Running = Record<string, { tool: string; startedAt: number }>;

declare module 'claude-code' {
  interface PluginState {
    telltale: {
      calls: Call[];
      dropped: number; // calls evicted past 200 (R25)
      view: View;
      selected: string | null;
      inventory: Inventory;
      folder: string; // absolute log folder for this session ('' until session start)
      start: string; // R10: the directory the session started in ('' until session start)
      warned: boolean; // R16: the write-failure notice was shown this session
      pending: Record<string, string>; // delta R12: pending call id -> agent id
      totals: Totals;
      running: Running;
      tick: number; // R29: bumped each second while a call runs, so the band redraws
      turnNo: number; // R34: the last turn number this process took
      toastedTurn: number; // R28: the turn that already had its toast
      message: string | null; // R39, R40: the detail view's last copy message
    };
  }
}
