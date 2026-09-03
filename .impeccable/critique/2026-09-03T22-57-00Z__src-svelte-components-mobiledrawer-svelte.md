---
target: hamburger menu on mobile
total_score: 20
max_score: 36
na_heuristics: 10
p0_count: 0
p1_count: 3
timestamp: 2026-09-03T22-57-00Z
slug: src-svelte-components-mobiledrawer-svelte
---
**Target:** `src/svelte/components/MobileDrawer.svelte` · viewed at `localhost:5173` · Mode: Operate · state inspected: logged-out (logged-in from user screenshot)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 1 | `aria-current` count 0 — drawer never shows which page you're on. |
| 2 | Match System / Real World | 3 | "Browse" → `/search` is the one mismatch. |
| 3 | User Control and Freedom | 3 | Escape/backdrop/close all work. No focus return. |
| 4 | Consistency and Standards | 2 | No dialog role/aria-modal/aria-label. Icon strokes 1.5 vs 2. |
| 5 | Error Prevention | 3 | Sign Out immediate, no confirm. |
| 6 | Recognition Rather Than Recall | 2 | "Settings" appears twice, adjacent, two meanings. |
| 7 | Flexibility and Efficiency | 2 | Six equal-weight nav items; nothing reflects the product loop. |
| 8 | Aesthetic and Minimalist Design | 1 | 239px empty spacer — 26% of a 923px panel. |
| 9 | Error Recovery | 3 | Logout failure caught, still proceeds. |
| 10 | Help and Documentation | n/a | Nav drawer carries no help surface. |
| **Total** | | **20/36** | **Needs work** |

## Design Specificity Verdict

Category-interchangeable. Strip the logo and this drawer ships unchanged in a banking app or a CRM. The page behind it is not generic at all — `NEXT EPISODE · 10H`, live countdowns, `AIRING NEXT` with `in 10h`. PRODUCT.md names broadcast timing as the differentiator; the drawer surfaces none of it.

**Deterministic scan:** 2 advisory `design-system-font-size` findings — 17px (line 322 `.drawer-logo-text`), 11px (line 386 `.drawer-nav-label`). Nothing structural.

**Visual overlays:** injection succeeded (7 overlay nodes) but every finding landed on the homepage behind the drawer, not the drawer.

## Priority Issues

- **[P1] No dialog semantics, no focus management.** role/aria-modal/aria-label all null; `focusInsidePanel: false`, activeElement behind the drawer. Screen reader gets no announcement; keyboard tabs into the page behind.
- **[P1] 239px of dead space.** `.drawer-spacer` 320×239 in a 923px panel; Login marooned below it.
- **[P1] Two touch targets under minimum.** `.drawer-close` 36×36, `.drawer-lang-toggle` 64×32 vs 44pt/48dp. (`.drawer-nav-item` 47px is fine.)
- **[P2] "Settings" means two things eight pixels apart.** ACCOUNT link to `/settings`, plus a SETTINGS section holding Title Language.
- **[P2] Version renders double-v.** Production shows `vv1.122.0`; template is `v{version}` and `__APP_VERSION__` carries the v.

## Persona Red Flags

- **Sam (Seasonal Watcher):** six equal links and 239px of nothing; "what aired?" indistinguishable in weight from "Light novels".
- **Jordan (First-Timer, logged out):** value proposition absent; Login past a void.
- **Riley (Screen-reader):** nothing announced, focus stays behind the panel.

## Minor Observations

- `overscroll-behavior: auto` — scroll chains to the page behind.
- body `overflow: hidden` does not hold on iOS Safari.
- "NAVIGATE" labels the self-evident.
- Logo and "Home" both link to `/`.
- Sign Out is the only coloured text, making the destructive action most salient.
- Icon stroke weights inconsistent (1.5 nav vs 2 close/lang).

## Resolution

All issues addressed in the same session except the specificity verdict, which the user declined deliberately: navigation stays neutral, so the dead space was closed by moving sign-in up rather than filled with airing data.
