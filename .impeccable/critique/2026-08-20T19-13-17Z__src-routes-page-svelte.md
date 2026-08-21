---
target: homepage
total_score: 16
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
timestamp: 2026-08-20T19-13-17Z
slug: src-routes-page-svelte
---
Method: dual-agent (A: design review, browser-inspected at 1440x900 and 390x844 · B: detector + in-page overlay)

# Design Critique — weeb.vip homepage

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 1 | Same episode shows two air days and two countdowns simultaneously; no `aria-current` anywhere |
| 2 | Match System / Real World | 1 | "Newest Anime" lists 1999–2015 titles; "Browse by Genre" contradicts the confirmed move to tags; `AIRING SOON` fires 19h out |
| 3 | User Control and Freedom | 2 | Hover-retarget is sticky with no way back to the default; no undo on Add to List |
| 4 | Consistency and Standards | 2 | Rails specified, grids shipped; hardcoded `oklch()` in PosterCard; accent spent 4–5x per viewport |
| 5 | Error Prevention | 1 | Add to List fires an unauthenticated mutation for signed-out visitors |
| 6 | Recognition Rather Than Recall | 2 | Both search inputs have empty placeholder and no `aria-label`; card metadata exists only behind `hover:hover` |
| 7 | Flexibility and Efficiency | 2 | No mark-watched, no bulk action, no jump-to-watchlist; the repeat loop is unaccelerated |
| 8 | Aesthetic and Minimalist Design | 3 | Hero is excellent; below it, 42 near-identical posters and three white 404 illustrations |
| 9 | Error Recovery | 1 | The broken-image state is a bright 404 illustration presented as cover art |
| 10 | Help and Documentation | 1 | Zero contextual help; signed-out visitors are never told what the product does |
| **Total** | | **16/40** | **Poor — major UX work required** |

The 16 is driven almost entirely by heuristics 1, 2, 5, 9 and 10 — where the schedule, which PRODUCT.md calls "the promise," contradicts itself on screen. The hero itself is the best-executed thing in the codebase.

## Design Specificity Verdict

**Authored for this product in the hero. Category-interchangeable everywhere below it.**

**Design review:** The first viewport could not be lifted into another product without rebuilding it — a 100svh art-first banner with a panel-glass content block opposite a live schedule panel. Below the fold it collapses into the Plex/Jellyfin/MAL default: three wrapped grids of 14 posters plus a row of grey pills. That contradicts the project's own written grammar — DESIGN.md specifies "rails scroll horizontally on every breakpoint" and "Don't wrap a horizontal rail into a grid at small breakpoints," and `.poster-row` is `display: grid` at every size.

**Deterministic scan:** CLI found 6 findings across the 6 homepage markup files (1 warning, 5 advisory) — `transition: width` on `.badge-track` (HeroBanner.svelte:300), two off-ramp clamp() endpoints on the hero title, 6px radii in HomepageSSR.svelte:606 and Header.svelte:203 against a 4/8/12/20 scale. The in-page overlay found 149 elements / 152 findings, concentrated in components the CLI scope did not cover.

**Where they disagree:**
- Detector caught what review missed: `.poster-sub` at 4.1:1 contrast (needs 4.5:1) on 42 cards, tracing to `--weeb-fg-muted` in design-tokens.css:31 — a token-level defect affecting the whole app. Also 91 instances of 10px `.hover-genre` text below the 11px functional floor.
- Detector also caught the one element bypassing the token system: `#navigation-progress` in app.html:128 uses `bg-gradient-to-r from-blue-500 to-purple-600` with a `#3b82f6` glow — precisely the blue-to-purple gradient the design system bans, in raw Tailwind hex.
- Review caught what no detector could: the P0 below, the unauthenticated mutation, and the rails-vs-grids system violation.
- False positives, correctly self-flagged: `text-overflow` on `.rail-name` (working ellipsis), `tight-leading` at exactly 1.30 (float boundary), `pulsing-dot` (already reduced-motion guarded). No dark-theme, oklch, or full-bleed-hero false positives fired.

**Overlays:** injection succeeded and the detector ran in the page, but the live server was stopped and the tab closed at end of run — no overlay is currently visible in the browser.

## Overall Impression

The hero is genuinely good and holds up under inspection — panel glass survives both pale and saturated key art, fold discipline is exact, the mono/sans split does real work. Then the page forgets what it is for. The biggest opportunity is not visual: the homepage does not serve the loop the product is built on. PRODUCT.md's job is "what aired -> mark watched -> what's next," and this page delivers one third of it, while the schedule it does show disagrees with itself.

## What's Working

1. **The panel/rail pairing is the right idea, correctly built.** The rail renders as a sibling of the keyed banner so retargeting does not drop keyboard focus. Panel glass holds against both pale and saturated key art — the Glass-By-Area Rule earning its keep.
2. **The mono/sans split carries the North Star with no effort from the reader.** `EP 371 Thu 6:40 PM` in JetBrains Mono beside a sans title reads instantly as "measured value" vs "name," applied consistently.
3. **The fold discipline is exact.** 100svh plus a smoothstep dissolve band sized entirely below the fold — verified at both viewports. Poster titles reserve two lines so sublines share a baseline.

design-tokens.css matches DESIGN.md value-for-value with no drift. The token layer is the healthiest part of the codebase — which is what makes the fg-muted contrast failure worth fixing at the token.

## Priority Issues

### [P0] The schedule contradicts itself inside a single viewport
**What.** Hero reads `Airs Wed 6:40 PM`, rail 300px away reads `Thu 6:40 PM`, same episode. Badge reads `AIRING SOON 18H`, rail row reads `Airing in 19h`. Verified in source: hero derives from `parseAirTime(episode.airDate, anime.broadcast)` (HeroBanner.svelte:110), rail from `info.nextEpisodeDate` (HeroAiringRail.svelte:29-30), countdowns from two independent sources rounding differently.
**Why it matters.** Principle 1 is "the schedule is the promise... however good it looks." Seeing Wed and Thu for one episode teaches the user the site cannot be trusted on the one thing it exists to do. No time carries a timezone marker, and `showJstPopover` is declared but never rendered.
**Fix.** One derivation. Compute `{airDateTime, countdown, isLive}` once in `processCurrentlyAiring()` and pass to both surfaces. Ship the JST affordance.
**Suggested command:** /impeccable harden

### [P1] The homepage does not serve the loop the product is built on
**What.** Every rail entry is future; recently-aired merges in with no separator; no episode-progress control anywhere on the page. All four below-fold sections are discovery.
**Why it matters.** Two of the loop's three steps are missing. Mobile shows 1.5 of 8 entries at 208px fixed card width, so "see the whole answer without scrolling twice" fails where the users are.
**Fix.** Split the rail into Aired and Next with a visible divider; optimistic single-tap mark-watched on each aired row; on mobile swap the 208px tray for a 4-row compact vertical list.
**Suggested command:** /impeccable shape

### [P1] Add to List fires an unauthenticated mutation
**What.** `handleAddAnime()` calls `mutate()` with no auth check (AnimeActions.svelte:30-36); signed-out homepage renders the button at full strength.
**Why it matters.** The conversion moment for an account-required product is a button whose only outcome is server rejection, with no gate, explanation, or value proposition on five screens.
**Fix.** Gate the handler: signed-out opens login/register with intent preserved, completing the add after auth. Add one line of value copy near the hero actions.
**Suggested command:** /impeccable onboard

### [P1] Grids where the system specifies rails — and the brightest object is the 404 asset
**What.** `.poster-row` is `display: grid` at all breakpoints against DESIGN.md. Inside, `/assets/not found.jpg` — a bright white illustration — rendered three times in one load, including a duplicate "Steel Ball Run" row, both `0 ep`.
**Why it matters.** Grids stretch mobile to 5,098px (six screens) on a surface whose principle is "short visit, complete job." A white illustration on near-black out-saturates every real poster, so the Art Is Brightest Rule is satisfied by the failure state.
**Fix.** Convert to `flex; overflow-x: auto; scroll-snap-type: x proximity` at all breakpoints; cut shelves from 14 to 8-10. Replace the fallback with a dark generated placeholder. Suppress `0 ep`.
**Suggested command:** /impeccable layout

### [P2] Baked-in title typography breaks the hero, and keyboard traversal strobes it
**What.** TVDB banner art carries the show's own title lockup, rendered across the viewport and sliced mid-word by the rail panel, duplicating the H2 below. `on:focus` retargets the banner, remounting the keyed HeroBanner; tabbing produces black-art-black-art with a fresh image request per Tab. Desktop CSS-hides entries 7-8, so a phone shows 8 and a 27" monitor shows 6.
**Why it matters.** "Arbitrary and unknown in colour" was planned for; arbitrary in typography was not. A keyboard user gets the viewport rewritten on every Tab.
**Fix.** Prefer the poster source with banner as fallback, or add a right-edge gradient. Debounce focus-retarget (~150ms) or require Enter commit; cross-fade instead of dropping to opacity 0. Drop the desktop nth-child hide.
**Suggested command:** /impeccable adapt

## Persona Red Flags

**Sam (keyboard + screen reader)** — worst served. Both search inputs announce "edit text, blank." No skip link; nine chrome stops before content. Tabbing the rail remounts the hero six times with no aria-live. PosterCard has no `:focus-visible` rule — UA default ring, 20px from the system accent ring on `.rail-item`. Focused cards scroll under the 60px fixed nav (no scroll-margin-top). Hover overlay has no `:focus-within` equivalent. No aria-current anywhere.

**Casey (distracted mobile, one-handed)** — sees 1.5 of 8 schedule entries. The `/` shortcut chip renders on a phone. Mobile header drops the wordmark. 5,098px of grid she will never reach. Hover-gated metadata unreachable on touch.

**Riley (stress tester)** — "Steel Ball Run" appears twice in Top Rated, both 9.1, both `0 ep · 2026`. "Newest Anime" contains 1999, 2001, 2004, 2007. Three console errors per load. Eleven of fourteen Top Rated scores inside 0.3.

**Catalogue keeper** — PosterCard encodes five watch statuses as 10px icon-only glyphs with no label, tooltip, or legend. No entry point to his list from the homepage: nav is Home / Season / Airing / Browse.

## Minor Observations

- Accent spent 4-5x per viewport against the Cursor Rule's "exactly one primary action plus current selection."
- `--weeb-green` now means nothing: the dot in "AIRING SOON" and the background of "Recently Aired." Green is specified as airing-now; it marks airing-now, airing-in-19-hours, and already-aired. Amber past ~6h would be honest.
- "Browse by Genre" contradicts the confirmed terminology move to tags — the homepage is the one surface that did not get the fix.
- The `EN` button reads as an interface-language switcher; its aria-label is "Toggle title language."
- PosterCard hardcodes three oklch() values and an inline shadow instead of --weeb-shadow-card. Score badge is 10px, below the 12px Numeral spec.
- `.section` uses literal 48px/28px/24px instead of --weeb-section-py (40/32/24).
- Hero Add to List carries seven dead Tailwind utilities that lose specificity to the scoped .btn-ghost.
- Season tabs offer current + 2 forward only.
- Footer exposes the build tag `vdev`.
- Hero background alt="Anime background" where the show title is available. Rail thumbnails correctly use alt="".

## Questions to Consider

1. If the hero owns the entire first viewport and nothing may peek, that viewport has to finish a job, not tease one. Why is the only completable action there "View Details," which leaves the page?
2. The rail is a schedule, a preview control, and a link list at once. If you had to pick one, which is it?
3. Three below-fold sections are Top Rated, Newest, Season. None is "yours." What does this page look like for a signed-in user with eight shows — and if the answer is "the same," what is the account for?
4. DESIGN.md specifies rails; the homepage ships grids. Which one is wrong?
5. "Cover art carries the product" is a strong thesis the hero honours. So why is the brightest object on the page a white 404 illustration, and why is discovery 17 grey text pills?
