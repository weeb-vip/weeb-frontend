---
target: the homepage
total_score: 18
max_score: 36
na_heuristics: 10
p0_count: 1
p1_count: 3
timestamp: 2026-08-19T21-49-24Z
slug: src-routes-page-svelte
---
Method: dual-agent (A: design review - B: detector + browser evidence), run in isolation.

Target: src/routes/+page.svelte -> src/svelte/components/HomepageSSR.svelte (+ HeroBanner, PosterCard, AiringStripCard, SectionHeader, GenrePills, +layout.svelte). Mode: Operate, with a Persuade edge for signed-out first visits.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | No nav active state; zero aria-current on any of four links (Header.svelte:37-42). |
| 2 | Match System / Real World | 2 | "Browse by Genre" -> /search?genre= (HomepageSSR.svelte:489, GenrePills.svelte:11); PRODUCT.md mandates tags, commit 45d643f moved search off genres. |
| 3 | User Control and Freedom | 2 | Hover swaps the 720px hero (HomepageSSR.svelte:428); lastHoveredAnime (:351-356) makes it sticky, no way back without reload. Season tabs walk forward only (:56-63). |
| 4 | Consistency and Standards | 2 | Air time mono on /airing, sans here. sub slot renders studio or year (:455). Tag chips 4px radius in hero, 20px pills below. |
| 5 | Error Prevention | 2 | 6 of 42 cards print "0 ep". Newest Anime sorted by insertion date. Doubled tags render unfiltered despite SearchPage.svelte:197 dedupe. |
| 6 | Recognition Rather Than Recall | 2 | Watchlist status = 22px colour notch + unlabelled 10px SVG, no aria-label (PosterCard.svelte:48-66). Card detail hover-only. |
| 7 | Flexibility and Efficiency | 1 | No keyboard route to hero swap. No way to mark an episode watched anywhere on the homepage. |
| 8 | Aesthetic and Minimalist | 2 | Three orphan rows (~1,200px dead black); ~6 cards showing 404 placeholder art; 20s infinite gradient covered by artwork. |
| 9 | Error Recovery | 1 | +page.server.ts:24-39 allSettled -> null, failed sections vanish silently. ssrError computed at :38, never rendered. |
| 10 | Help and Documentation | n/a | Read-and-jump surface, no configurable or multi-step task on the page. |
| **Total** | | **18/36 (50%)** | **Acceptable - bottom edge** |

## Design Specificity Verdict

Category-interchangeable. Netflix-shaped: hero with scrim, horizontal strip, rows of 2:3 posters with corner score badges. Nothing in the composition says this product tracks broadcast schedules.

The Mono Numeral Rule - DESIGN.md's "typographic signature of the system" - is implemented on eighteen other components and zero homepage components. /airing looks like a schedule desk; / looks like a store.

Deterministic scan: 37 CLI findings across 10 files (design-system-font-size x20, design-system-color x9, design-system-radius x5, layout-transition x2 warning, dark-glow x1 warning). +page.svelte and +layout.svelte clean. In-page overlay: 148 elements / 151 findings.

Measured: at 390px, of 456 text-bearing elements exactly 4 use JetBrains Mono (.ac-kbd x2, .label, .version) - none are schedule values. Desktop sweep: 5 distinct font-family stacks (two beyond DESIGN.md's two), 10 distinct computed font sizes, six off the documented ramp.

Detector caught what the review missed:
- app.html:128 nav progress bar: bg-gradient-to-r from-blue-500 to-purple-600 + box-shadow rgba(59,130,246,.6). Fires dark-glow and ai-color-palette. That blue is nowhere in the palette.
- 33 of 85 interactive elements under 44x44 at 390px.
- 54 of 56 images loading="lazy" including above-fold. LCP 1844ms on a poster IMG, not the hero.
- gpt-thin-border-wide-shadow on .hero-poster: 0.67px border under 60px shadow blur.

False positives discounted: 13px sizes (documented in DESIGN.md prose, absent from frontmatter ramp - the frontmatter is out of sync, not the code); pure-black scrim alphas; HeroBanner.svelte:393's 24px responsive step below the Display clamp floor. Detector raised no complaint about dark-only, system sans, or JetBrains Mono.

Overlay ran in-page during Assessment B; tab and overlay server were closed on completion. Dev server on 5173 left running.

## Overall Impression

Bones are good, code is conscientious. The problem is a measurable ranking inversion: the amber score badge sits at 6.88:1 contrast while the air-time chip sits at 2.9-3.4:1. The decorative rating is twice as legible as the schedule.

## What's Working

1. SSR-first data architecture: parallel allSettled queries (+page.server.ts:24-31), server-computed bannerImageUrl as preload fetchpriority=high (+page.svelte:14-18), TanStack hydrating from initialData. TTFB 384ms, DCL 468ms, CLS 0.0000, 0 console errors, 0 failed requests.
2. AiringStripCard is the one component that understands the product: five facts correctly ranked in 300px.
3. Hard-won a11y fixes in place and documented: sr-only h1 (HomepageSSR.svelte:381-385), hero title demoted to h2, hover guards behind @media (hover: hover).

## Priority Issues

### [P0] Every schedule value fails WCAG AA

.airing-time 11px 2.9-3.4:1; hero .air-time 13px 3.49:1; .airing-ep 12px 3.56:1; .ac-kbd 11px 3.86:1; .poster-sub 10px 4.08:1 (x42). For comparison .score-badge 10px 6.88:1 PASSES.
411 of 456 text elements below 12px at 390px. 33 of 85 tap targets under 44x44.
Violates PRODUCT.md Principle 1 and DESIGN.md's airing-strip spec.
Fix: air times/countdowns/episode numbers to --weeb-fg at Numeral scale, 12px min. Drop the tinted .airing-time chip ground. Raise .poster-sub and .airing-ep to --weeb-fg-secondary. Pills and season tabs to 44px min height.
Suggested: /impeccable audit, then /impeccable typeset

### [P1] Mono numeral signature absent here, present on eighteen other components

--weeb-font-mono defined at design-tokens.css:48. Across all seven homepage components grep returns one hit and it is font-family: inherit (HomepageSSR.svelte:629). Affected: .airing-local-time, .airing-time, .airing-ep, .progress-label, .score-badge, .poster-sub, .badge-countdown, .air-time.
Fix: add font-family: var(--weeb-font-mono); font-size: 12px; font-weight: 500; letter-spacing: 0.02em to those eight selectors; delete redundant tabular-nums. ~20-line diff.
Suggested: /impeccable typeset

### [P1] Poster rails are grids, producing three orphan rows and ~1,200px of dead black

.poster-row is grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)) (HomepageSSR.svelte:564-569), fed 14 items into a 13-column track. Top Rated, Newest Anime, Seasonal Highlights each render a second row with one card beside twelve empty cells. Mobile: 3 cols x 5 rows, page grows to 4,950px.
Violates DESIGN.md "rails scroll at every size; don't wrap into a grid".
Fix: match .airing-strip - display: flex; overflow-x: auto; gap: 16px; scroll-snap-type: x mandatory; flex: 0 0 160px. Deletes ~50 lines of breakpoint CSS (:576-593, :672-693).
Suggested: /impeccable layout

### [P1] "Newest Anime" ships placeholder artwork and 1990 titles

Six cards display a literal 404 Not Found illustration. CDN serves them with HTTP 200 (0 failed requests, 0 broken images, 0 local fallbacks among 56), so SafeImage's fallbackSrc cannot fire. Titles include Nineteen 19 (1990), Tsukiyomi (2013). Four tag chips render doubled despite the dedupe at SearchPage.svelte:197.
Fix: skip known-placeholder images; suppress the ep clause when episodeCount is 0; re-sort by startDate desc or rename to "Recently Added"; lift tag dedupe into a shared util.
Suggested: /impeccable harden

### [P2] Hero hijacks the fold, then mutates on incidental mouse movement

min-height: 720px (HeroBanner.svelte:208) + 60px sticky nav = 780px before any schedule content. At 1440x900 no airing card is visible.
Scrim: HeroBanner.svelte:241-246 stacks two multiplying gradients. Combined art coverage: bottom-left 100%, left edge at 40% height 95.5%, left edge at top 79%, right side at top 30%. No pixel of the hero shows unshaded artwork. On mobile the hero poster is display:none below 1024px (:388), so the banner is a near-black rectangle with ~250px of void above the badge. Fails The Art Is Brightest Rule on the primary device.
Root cause is the text footprint, not the scrim: .hero-content is a 640px bottom-anchored column with badge, 44px title, 250-char description and actions.
on:mouseenter (HomepageSSR.svelte:428) replaces the hero on pointer crossing; lastHoveredAnime makes it permanent; no keyboard/touch/focus equivalent.
Fix: cut the description from the hero; drop the to-right gradient; retune the vertical scrim to transparent by ~55% height; min-height to clamp(420px, 48vh, 560px); delete .hero-bg-animated (:208-218); make the swap a deliberate selection with on:focus, a visible selected state, and mouseleave reversion.
Suggested: /impeccable distill, then /impeccable layout

## Persona Red Flags

Mika (Seasonal Watcher, primary audience): needs what aired / mark them / what's tonight. Gets a hero for a show she may not follow, then scrolls 780px to a strip mixing her shows with everyone's - no "mine" filter, and no watchlist status is passed to airing cards at all (HomepageSSR.svelte:416-431). Cannot mark anything watched. The homepage does not support the loop the product is built around.

Sam (Accessibility-Dependent): every schedule value fails AA. grep focus-visible returns zero hits across PosterCard, AiringStripCard, GenrePills, HeroBanner, SectionHeader - ~66 links fall back to the UA ring over dark artwork; DESIGN.md's accent focus ring unimplemented. Watchlist status is colour + unlabelled 10px SVG. 20s infinite gradient and forever-pulsing dot with no prefers-reduced-motion guard, though the guard exists in four other components in this repo.

Casey (Distracted Mobile): ~250px empty black at top of phone. Scrolls past 540px of hero to see one airing card. Titles 11px, subs 10px at 4.08:1. Page 4,950px tall, ~3,400px discovery grid. All secondary card info hover-gated. 33 tap targets under 44px.

Ren (Discovery-First, signed out): hits Newest Anime, sees six 404 placeholders and a 1990 title, concludes catalogue is thin. Browse by Genre: 16 undifferentiated pills, no counts/art/ordering, linking to ?genre= after the product moved to tags. Bottom of page: orphan row, footer. Never asked to sign up or told what tracking does. Persuade edge entirely unbuilt.

Cognitive load: 5 of 8 checklist items fail. 74 competing clickable choices at near-identical visual weight; five decision points exceed 4 options.

## Minor Observations

- Amber and accent swapped vs documented meanings: "AIRING SOON" uses --weeb-accent where Signal-Not-Decoration assigns amber; amber spent on score badges (~42 instances), not a status.
- Pulsing green dot fires on the Airing Soon (not-live) badge; the genuinely live case is plain green "LIVE" text with no dot. Inverse of spec.
- Accent appears on hero badge, air-time chips (x8), View Details, Login, season tab, bookmark tab, card hover border, progress fill, three "See all" links. Cursor Rule budget is a tenth of a screen.
- .hero h2 is font-weight 700; DESIGN.md Display spec is 800.
- .on-list-tab uses clip-path polygon - angular clipping, explicitly ruled out.
- Hero poster has a border over artwork where the spec drops it.
- .genre-row uses flex-wrap: wrap against "chip rows scroll, never wrap".
- Airing cards have a hairline and no shadow, inverting the elevation spec.
- Hardcoded oklch() in ~11 places across HeroBanner, AiringStripCard, PosterCard, plus white hairlines oklch(100% 0 0 / 0.12) and / 0.2 at PosterCard.svelte:251-252.
- console.log at module scope (HomepageSSR.svelte:92), inline console.log in markup (:439), debug IIFE in markup (:440) - the last two run every render and ship in SSR output.
- Hero alt text is the literal string "Anime background"; hero synopsis stacks a 250-char slice and -webkit-line-clamp: 3.
- edge-flush-cards: a card sits flush at 0px against the left edge of .airing-strip at rest.
- DESIGN.md drift: 13px documented in prose but missing from the frontmatter typography ramp, which is why the detector flags it five times. Worth /impeccable doctor separately; not touched.

## Questions to Consider

1. What is this page for, in one sentence? If it is where a seasonal watcher completes the loop, the airing strip is the page - so why does the garnish own the first 780px, and why can't you mark an episode watched on it?
2. What if the homepage were /airing with a hero on top? The one component that understands the product appears once, below the fold, at 12% of scroll height.
3. Why is the rating more legible than the air time? 6.88:1 vs 2.9:1.
4. What would a confident "Newest Anime" look like? Is the honest version "Recently Added" with junk filtered, or should that rail not exist, with its 1,200px going to the schedule?

## User direction captured this session

The user questioned why the banner art is shaded out and asked for a much cleaner look. Both are corroborated by measurement (see P2 and P1-rails). Shrinking the hero addresses both at once: it lets the art through and pulls the schedule above the fold.
