---
target: homepage
total_score: 20
max_score: 36
na_heuristics: 9
p0_count: 0
p1_count: 3
timestamp: 2026-08-21T00-54-47Z
slug: src-routes-page-svelte
---
Method: dual-agent (A: design review, browser-inspected at 390/1440/2526 · B: detector + in-page overlay)

# Design Critique — weeb.vip homepage

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | `aria-current="page"` is set on nav but has zero CSS — all four items compute identically |
| 2 | Match System / Real World | 2 | "Newest Anime" shows 1999–2008 titles; "Browse by Tag" links to `?genre=` |
| 3 | User Control and Freedom | 3 | Season tabs are forward-only; no path to last season |
| 4 | Consistency and Standards | 2 | Countdown reads `8H` in the badge and `Airing in 8h` in the rail, 40px apart |
| 5 | Error Prevention | 3 | The signed-out Add-to-List gate carries intent through sign-in |
| 6 | Recognition Rather Than Recall | 2 | Card synopsis/tags exist only in a `hover:hover`, `aria-hidden` overlay |
| 7 | Flexibility and Efficiency | 2 | No way to mark an episode watched from the homepage |
| 8 | Aesthetic and Minimalist Design | 3 | Hero is excellent restraint; the body shows score and episode count twice per card |
| 9 | Error Recovery | n/a | No error surface reachable in the signed-out browse path |
| 10 | Help and Documentation | 1 | One line of contextual help on the whole page |
| **Total** | | **20/36** | **Acceptable — significant work needed** |

Note: Assessment A reported 22/36; its own scores sum to 20. Corrected here.

## Design Specificity Verdict

**Authored for this product in the first viewport; category-interchangeable below it.**

The 100svh hero with a panel-glass block bottom-left and a schedule rail bottom-right
says something true: artwork and timetable are equal citizens. Below the fold it
collapses into three identical poster grids. Nothing in the ~4,200px below the hero
knows this product tracks a schedule: `.status-dot` count is 0 (the green/amber dots
never render), no next-episode line, no watched state. The shelf order puts the most
generic content first — "Summer 2026 Highlights", the only shelf that could not appear
on a generic media app, is fourth.

**Deterministic scan:** the CLI ran DEGRADED again — parser modules unavailable, regex
fallback, so custom properties, selector matching and computed contrast were not
evaluated. 3 findings, one a false positive (regex matched a literal `<img>` inside a
code comment). The in-page overlay found 8 findings across 6 nodes: `pulsing-dot`
(error, but already reduced-motion guarded), 3× `text-overflow` on `.rail-name`,
`kicker-above-heading`, `layout-transition` (transitions.css:87), 2×
`gpt-thin-border-wide-shadow`.

**The number that matters:** the overlay found 149 elements / 152 findings in the
previous run and 8 now. The contrast, focus, live-region and touch-target clusters are
gone.

**Disagreement:** A claims no `:focus-visible` rule exists for poster cards. The global
rule is present at base.scss:69, and an independent pass earlier measured 94 authored
rings, 0 UA defaults, at 8.24:1. A likely scanned `document.styleSheets` and missed the
Vite-injected SCSS. Not repeated as fact; worth one direct check.

## What's Working

1. The hero's two-panel composition solves a real problem — panel glass bounds text
   legibility by the panel rather than by whichever show is featured, and the smoothstep
   fade band is sized so none of it sits above the fold. Holds at 390, 1440 and 2526.
2. `titleTier` length-stepped sizing, computed during render so SSR emits the final size.
3. The rail is a sibling of the keyed banner, so keyboard focus survives retargeting.

## Priority Issues

### [P1] The homepage does not serve the product's primary job
The loop is "what aired → mark watched → what's next"; the page covers only the third.
`.on-list-tab` exists but is a passive colour notch with no accessible name and no way to
change state. Fix: replace the "Top Rated" slot under the hero with "Since you were here"
(signed-in) / "Airing Today" (signed-out) — the data is already in `sortedCurrentlyAiring`
— with an inline mark-watched control. Suggested command: /impeccable shape

### [P1] "Newest Anime" is a shelf of twenty-year-old shows
Doraemon 1999, Ghost Stories 2001, Battle B-Daman 2004. Almost certainly sorted by
insertion date. On a product whose differentiator is temporal accuracy, a time label over
a non-time ordering is the most damaging thing on the page. Fix: sort by startDate desc,
or rename the shelf to what it is.

### [P1] The schedule rail truncates the titles it exists to communicate
"That Time I Got Reincarnated as a Slime Season 4" needs 359px, gets 148px. Four of six
entries ellipsised at 41–56%, while ~450px of empty artwork sits beside them at 1440. Two
more hidden outright by `nth-child(n+7)`. Fix: widen to `clamp(340px, 26vw, 460px)` and
let the name wrap to two lines.

### [P2] `.rail-all` renders at full brightness — self-inflicted
Adding the touch-target `::after` closed the rule early, swallowing `color`,
`text-decoration` and `white-space` into a pseudo-element with `content: ''`. "Full
schedule →" is now as bright as the show titles above it. Currently on main.

### [P2] `aria-current="page"` has no visual counterpart
The attribute was added in the accessibility pass and never styled — 0 CSS selectors
reference it. Screen readers announce the current page; sighted users get nothing, and
DESIGN.md requires the active item to carry the accent.

### [P2] The skip link is focusable element 11
Added before `<main>` but after `<Header>`, so it follows the logo, four nav links,
search, language toggle, Login and Register. A skip link reached after nine stops is
decoration.

## Persona Red Flags

**Casey (distracted mobile)** — the airing tray shows 1.5 of 8 cards at 390px, requiring
horizontal swiping inside a vertically scrolling page. `.hero-desc` is hidden below
1025px. "Broadcast time" wraps to its own line as a bare grey phrase with an invisible
dashed border.

**Sam (accessibility-dependent)** — skip link at position 11; `.hover-overlay` is
`aria-hidden` and is the only place synopsis/episodes/tags live; `.on-list-tab` encodes
five watchlist states by fill colour plus a 10px glyph with no text alternative;
`.rail-when.is-live` measures ~4.28:1 at 12px on panel glass — under AA, on the live-now
state.

**Alex (power user)** — `/` focuses search, the one accelerator. Cannot mark an episode
watched at all. Hovering a poster blacks out the artwork to show data already visible
below the card. "See all →" on two different shelves both resolve to `/search`.

**Seasonal watcher (primary audience)** — rail entry 1 restates the hero. No indication of
what aired since the last visit. Cannot mark anything watched. Rail shows 6 of 8 with no
guarantee her shows are among them. The countdown column reads 13h, 13h, 13h for three
consecutive entries — the loudest column is the least discriminating.

**Catalogue keeper** — `.on-list-tab` is the only status surface and has no legend. No
filter, sort or count. "Top Rated" shows Steel Ball Run twice and five Gintama entries,
which reads as a data-integrity problem in the catalogue holding her list.

## Minor Observations

Hero panel and section headings do not share a gutter (32px vs 48px) · the two hero panels
are 16px out of vertical alignment despite DESIGN.md calling them "matched" · countdown
casing disagrees (`8H` vs `8h`) · debug `console.log` renders inside the template at
HomepageSSR.svelte:455-456, against CLAUDE.md's own instruction · GenrePills is a
hardcoded 16-item array under a "Browse by Tag" header linking to `?genre=` ·
`.hover-genre` uses the `--weeb-border` Edge token as a fill · footer ships `vdev` and two
developer links as the final impression · `.rail-title` is an `<h2>` rendered at 12px
uppercase Label scale.

**Unverified:** text-over-hero contrast. Both tools failed to measure it — the CLI was
degraded, and the overlay identified five candidates needing pixel analysis it could not
perform from page context.

## Questions to Consider

1. If the hero already answers "what's next", what is the rest of the page for?
2. Why can't a poster card be acted on? It is the product's atomic unit and it is inert.
3. "Top Rated" has been the same twenty shows for years. Is it first because someone
   decided it should be, or because it was the first query that existed?
4. Count the accent in the first viewport: badge, CTA, Login. If you kept exactly one,
   which — and does that tell you the badge is wearing the wrong colour?
