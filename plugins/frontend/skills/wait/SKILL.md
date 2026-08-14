---
name: wait
description: 'Shape the perceived wait — loading indicators, skeletons, optimistic updates. Use when building UI where content takes time to arrive, or when reviewing a screen that stalls. Not for the latency budget itself (how long a wait is acceptable) or for post-action success confirmation; the broader state floor lives in frontend:guidelines.'
---

# Loading States

Design every wait a user can hit — initial load, submit, pagination, refresh, image loads. Pick each state deliberately, never leave it to a framework default.

## Choosing the Pattern

Default to **skeleton**: a shimmering outline of the layout. It sets expectation and makes the wait feel shortest. Deviate only when a condition earns it:

- **Measurable progress** (upload, multi-step job) — a determinate progress bar with percent or step count.
- **Tiny, unknown-duration action** (button submit) — an inline spinner in the triggering control.
- **User-caused mutation** (like, save, toggle) — optimistic UI: render the result instantly, roll it back visibly on failure.
- **Slow media** — progressive reveal: blur-up images, critical content first, lazy-load below the fold.

## Duration Tiers

| Wait        | Response                                                            |
| ----------- | ------------------------------------------------------------------- |
| Under 100ms | No indicator; the wait is invisible                                 |
| 100ms–1s    | Subtle skeleton or opacity shift                                    |
| 1–10s       | Skeleton plus spinner; progress bar if measurable                   |
| Over 10s    | Progress detail, a time estimate, and a cancel or background option |

## Motion and Layout

- Fade content in over ~200ms so arrival reads as a continuation of the shimmer, not a flash.
- Reserve skeleton dimensions matching the final content, so loaded content lands without shifting layout.
- Keep scroll position stable across refreshes.
- Honor `prefers-reduced-motion`: swap the shimmer for a static placeholder.
- For staggered lists, brief successive delays feel organic — each item reads as arriving, not rendering.

## Completion

- Every wait state above 100ms has a chosen pattern — including the error and empty outcomes of the load.
- First paint always carries a loading affordance; the screen shows intent from frame one.
- One loading indicator per region at a time.
- Loads over 10s offer a way out or a way to background them.
- Verified on a throttled connection (e.g. Slow 3G), where skeleton proportions and transition timing are actually exercised.
