---
name: mcp-elicitation
description: Use when implementing mid-call user interaction, prompt autocomplete, progress tracking, or cancellation in the TypeScript SDK v2.
when_to_use: Elicitation, progress tracking, cancellation, autocomplete, completable fields, inputRequired.
user-invocable: false
metadata:
  category: technique
---

# MCP Elicitation

## When to Use

- Tool needs mid-call operator input, confirmation, or progress tracking.
- Client needs to register auto-fulfillment handlers.
- Prompt arguments require dynamic autocompletion.

## Steps

1. **Elicit Input**: Return `inputRequired(...)` from your tool callback when user input is needed.
2. **Handle Stateless Return**: Store multi-round session parameters in the opaque `requestState` string so callbacks can resume seamlessly once the responses are accepted. Note: `requestState` is attacker-controlled — keep it opaque and HMAC-verified, never secrets (see `references/mechanics.md`).
3. **Emit Progress**: Emit operation updates using `notify()` in the handler's execution.
4. **Guard Cancellation**: Pass `signal` to database or HTTP calls, and verify `signal.aborted` within recursive functions or loop conditions.
5. **Autocompletion**: Wrap prompt arguments (fields of a prompt's `argsSchema`; resource template variables use the template's `complete` map, not `completable`) within standard `completable(...)` schema builders to allow prompt suggestions dynamically.

## Completion Criteria

To consider elicitation and mid-call interaction complete, you must verify:

- [ ] No mid-call tool handlers block threads or run synchronously while awaiting user actions.
- [ ] The `requestState` codec is wired (HMAC-verified) and no secrets are placed in the attacker-controlled `requestState` payload.
- [ ] All forms, input widgets, and prompt arguments are clear, validated, and do NOT request credentials or access key secrets.
- [ ] The engine verifies `signal.aborted` on every iteration of loops or long database inquiries.
- [ ] All 2026-era interaction flows return modern `inputRequired` descriptors instead of the legacy `elicitInput()` (2025-era only; throws on 2026-era).
- [ ] No deprecated sampling/roots/logging builder is used; replacements per `references/mechanics.md`.

## Reference Guides

- [Mechanics](references/mechanics.md): Protocol details for input, progress, autocomplete, cross-round state, and deprecated surfaces.
- [Code Examples](references/examples.md): Implementation code blocks.
