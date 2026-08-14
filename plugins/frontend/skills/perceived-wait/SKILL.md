---
name: perceived-wait
description: 'Shape the perceived wait — loading indicators, skeletons, optimistic updates. Use when building UI where content takes time to arrive, or when reviewing a screen that stalls. Not for the latency budget itself (how long a wait is acceptable) or for post-action success confirmation.'
---

# Loading States

Design every wait user can hit — initial load, submit, pagination, refresh, image loads. Pick each state deliberately, never leave to framework default.

## Choosing the Pattern

Default to **skeleton**: shimmering outline of layout. Sets expectation, makes wait feel shortest. Deviate only when condition earns it:

- **Measurable progress** (upload, multi-step job) — determinate progress bar with percent or step count.
- **Tiny, unknown-duration action** (button submit) — inline spinner in triggering control.
- **User-caused mutation** (like, save, toggle) — optimistic UI: render result instantly, roll back visibly on failure.
- **Slow media** — progressive reveal: blur-up images, critical content first, lazy-load below fold.

## Duration Tiers

| Wait        | Response                                                        |
| ----------- | --------------------------------------------------------------- |
| Under 100ms | No indicator; wait invisible                                    |
| 100ms–1s    | Subtle skeleton or opacity shift                                |
| 1–10s       | Skeleton plus spinner; progress bar if measurable               |
| Over 10s    | Progress detail, time estimate, and cancel or background option |

## Motion and Layout

- Fade content in over ~200ms so arrival reads as continuation of shimmer, not flash.
- Reserve skeleton dimensions matching final content, so loaded content lands without shifting layout.
- Keep scroll position stable across refreshes.
- Honor `prefers-reduced-motion`: swap shimmer for static placeholder.
- For staggered lists, brief successive delays feel organic — each item reads as arriving, not rendering.

## Confidence Checklist

- Every wait state above 100ms has chosen pattern — including error and empty outcomes of load.
- First paint always carries loading affordance; screen shows intent from frame one.
- One loading indicator per region at a time.
- Loads over 10s offer way out or way to background them.
- Verified on throttled connection (e.g. Slow 3G), where skeleton proportions and transition timing actually exercised.
