---
target: anime detail page
total_score: 17
max_score: 36
na_heuristics: 10
p0_count: 1
p1_count: 3
timestamp: 2026-08-21T01-20-25Z
slug: src-routes-anime-slug-page-svelte
---
Method: dual-agent (A: design review, browser-inspected at 370/1440 across three shows · B: detector + in-page overlay)

# Design Critique — anime detail page (/anime/[slug])

First run for this surface — no trend yet.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 1 | A 2010 film renders "● Airing" in green |
| 2 | Match System / Real World | 2 | "Fridays at 22:30 (JST)" and "Fri 21 Aug, 9:30 AM" local, same fact, neither labelled |
| 3 | User Control and Freedom | 2 | Every +/- fires a mutation with no undo; no per-episode control |
| 4 | Consistency and Standards | 1 | Three add-to-list buttons, two capitalisations, three weights |
| 5 | Error Prevention | 3 | Signed-out gating is exemplary; hero button label drops to 1.21:1 on hover |
| 6 | Recognition Rather Than Recall | 2 | Six consecutive rows read "The Frontier Lord and the ..." |
| 7 | Flexibility and Efficiency | 1 | 500 episodes, ascending, in a 520px box — 34,833px in a 519px window |
| 8 | Aesthetic and Minimalist Design | 3 | Hero composition holds; news outweighs episodes 2.2:1 |
| 9 | Error Recovery | 1 | "LICENSORS: None found, add some" renders as data |
| 10 | Help and Documentation | n/a | A show page needs no documentation surface |
| **Total** | | **17/36** | **Poor — major UX work required** |

The homepage scored 20/36 on the same scale the same night. The hero carries most of
these points; the tracking machinery below it carries almost none.

## Design Specificity Verdict

Authored above the fold, generic and slightly off-brief below it. The first viewport uses
the panel glass recipe (0.90 alpha, saturate(0.9)) rather than bar glass — the non-obvious
correct call. Below y≈900 it could be lifted onto MyAnimeList with a palette swap.

News occupies 1,065px on mobile against Episodes' 475px — 2.2x the space, positioned above
it. PRODUCT.md principle 4 rules out a feed layer; a dated, sourced, category-chipped feed
with "View all 7 news" is the closest thing to one you could build without naming it.

**Detector caveat that invalidates part of every critique this session:** the "degraded"
warning never fires for .svelte files, because .svelte routes to the regex engine which
never attempts the parser import. Custom properties, selector matching and computed
contrast have gone silently unevaluated on every Svelte file. Proof: the CLI reported zero
contrast findings while the overlay measured 12 real WCAG failures on the same run.

Two findings verified and discarded: `broken-image` matched `<img>` inside a // comment at
SafeImage.svelte:64; `layout-transition` on <body> is CSS's initial transition-property:
all at 0s duration.

## What's Working

1. The signed-out add-to-list gate is design work, not plumbing — waits for
   isAuthInitialized, names the show in the modal copy, completes the original intent via
   onAuthed. Esc, focus return and aria-modal all correct.
2. Glass discipline is right and non-obvious: panel recipe on panels, bar recipe on nav,
   verified against both near-white and saturated key art.
3. The mono-numeral signature holds across all three shows tested, including 500 rows.

## Priority Issues

### [P0] The episode list cannot do the job the product exists for
500 rows in max-height: 520px — a 67:1 nested scroll box, ascending, newest episode 34,314px
down an inner scroller. .ep-row has cursor: pointer and a hover background with zero
interactive attributes in the entire file (no on:click, href, role or tabindex) — a false
affordance on all 500 rows. No watched marker anywhere on the page. SSR payload 796KB for
Naruto, 960KB for Bleach, against principle 3 "fast beats rich". Step 2 of the recurring
loop does not exist here.
Fix: drop max-height and scroll with the page; newest-first or anchor to next unwatched;
cap SSR at ~25 rows with an expander; per-row watched toggle; make the row a real button or
drop cursor:pointer; wrap titles to two lines; mark the next-to-air row with local time.

### [P1] The primary action is triplicated
Verified at ShowContent.svelte 413, 480, 600. Two capitalisations, three weights. The one a
first-time visitor sees above the fold is the ghost variant; the accent-filled duplicate is
below the fold at both viewports. Its hover:text-black measures 1.21:1 — the label vanishes
on hover.

### [P1] The tab bar reintroduces both values DESIGN.md retired
Written entirely in inline styles under an Astro-era ViewTransitions comment, in a SvelteKit
app. Hardcodes oklch(55% 0.15 280) — the accent the Hue-Separation Rule replaced — and
oklch(55% 0.01 270) — the muted lightness raised to 62% for failing AA. Measured 3.92:1 and
4.08:1. Invisible to a token audit because they are inline literals. No role="tab" or
aria-selected either.

### [P1] Status contradicts itself on non-airing shows
`{anime.endDate ? "Finished" : "Airing"}` (line 515) reads absence of an end date as
currently broadcasting. A 2010 film shows "● Airing" green, "Ongoing", "0 ep" and "0/1"
simultaneously. Over half the shows in the first sitemap page have zero episodes — this is
the common rendering, not the edge case.

### [P2] 175px of sticky chrome against a 72px scroll-padding-top
Nav 60 + compact bar 73 + tab bar 43. Every browser-driven scroll lands 103px under the
stack; keyboard focus disappears behind it. On a 667px phone that is 26% of the viewport.
Touch targets: tab buttons 42-43px, the +/- episode buttons 28x32px.

## The systemic one

The 12 contrast failures are `color: var(--weeb-accent)` used as text — the exact failure
--weeb-accent-text was created for. App-wide: --weeb-accent is used as a text colour 39
times across 17 files (3.81:1); --weeb-accent-text is used in 2 files (8.24:1). The fix was
right in kind and almost entirely unapplied in reach.

## Persona Red Flags

**Casey (mobile)** — the countdown lands at y=716-775 on an 838px viewport, off the fold on
most phones. The +/- buttons are 28x32px, the only way to record progress. 36% of the fact
chips are silently clipped with no affordance.

**Sam (accessibility)** — tab labels 4.08:1, count badges 3.92:1, episode numbers 3.32:1.
No role="tab"/aria-selected. scroll-padding-top 72px against 175px of chrome parks focus
behind the bars. 500 non-focusable rows styled cursor:pointer.

**Riley (stress tester)** — 500 episodes to a 67:1 scroll box and a 796KB document; a show
with 0 episodes/news/characters collapses to hero + synopsis + info, with a Characters tab
leading to "No character data available."; a 2010 film reporting Airing/Ongoing/0 ep/0-of-1;
"LICENSORS: None found, add some" rendered as a value.

**Seasonal watcher (primary)** — arrives to answer "did ep 7 drop, when's ep 8?". Episode 7
is styled identically to 1-6 apart from 0.5 opacity on a 13px numeral, with no local air
time and no way to mark it watched. Three separate places show timing, none beside the
episode it belongs to. The page never says "you're up to date."

**Catalogue keeper (secondary)** — the five statuses are unreachable until the show is on
the list (Add to list hardcodes PLANTOWATCH). Progress is a single integer, so a backlog
watched out of order is unrepresentable. Score renders visible-but-disabled with no stated
precondition.

**Discovery browser (secondary)** — best served, and it shows. But tags render only in the
hero and only when present, so the tag-based browsing loop has no re-entry point from this
page.

## Minor Observations

Three unlabelled quality numbers coexist (#4933, a bare 7.1 chip, and your Score) · news
category chips spend green/amber as category colour, against Signal-Not-Decoration · the
login modal's accessible name is aria-label="Dialog" while its visible title is not a
heading · Information has no tab while Characters always does, including when empty · long
titles collide with burned-in key art logotypes · migration residue is load-bearing: the
Astro rationale is the stated reason the tab bar bypasses tokens.

Unmeasured: CharactersWithStaff.svelte's 9 hardcoded oklch() colours — the component renders
its empty state on this show, so neither tool exercised them.

## Questions to Consider

1. The countdown renders in three places and watched state in zero. What would this page
   look like if you deleted two countdowns and spent that space on marking an episode watched?
2. You solved a length problem on the homepage by capping item count; here the same problem
   is solved by capping pixels — the pattern the Single-Axis Rule rejects. Why the different
   answer?
3. Score and +/- render disabled for every first-time visitor. What is a dead control
   teaching them that an inline "Add this show to track episodes" wouldn't?
4. This page renders identically whether reached from browse or from your own list. If you
   knew someone arrived from "Currently Watching", what would go in the first viewport?
