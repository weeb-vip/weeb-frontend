---
name: weeb.vip
description: Dark, art-forward anime tracking — a precision schedule desk inside a lit gallery.
colors:
  bg: "oklch(14% 0.015 275)"
  bg-elevated: "oklch(18% 0.018 275)"
  surface: "oklch(22% 0.02 275)"
  surface-hover: "oklch(26% 0.022 275)"
  border: "oklch(28% 0.015 275)"
  fg: "oklch(95% 0.005 265)"
  fg-secondary: "oklch(70% 0.01 270)"
  fg-muted: "oklch(62% 0.01 270)"
  accent: "oklch(55% 0.16 298)"
  accent-hover: "oklch(63% 0.17 298)"
  accent-text: "oklch(74% 0.14 298)"
  panel-bg: "oklch(22% 0.02 275 / 0.90)"
  scrim: "oklch(0% 0 0 / 0.88)"
  green: "oklch(65% 0.15 155)"
  amber: "oklch(72% 0.14 85)"
  red: "oklch(60% 0.18 25)"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: "clamp(28px, 4vw, 44px)"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.25
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    letterSpacing: "0.04em"
  numeral:
    fontFamily: "'JetBrains Mono', ui-monospace, Menlo, monospace"
    fontSize: "12px"
    fontWeight: 500
    letterSpacing: "0.02em"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  pill: "20px"
  full: "9999px"
spacing:
  section-px: "48px"
  section-py: "40px"
  nav-height: "60px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "7px 18px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
    textColor: "#ffffff"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.fg-secondary}"
    rounded: "{rounded.md}"
    padding: "7px 18px"
  button-ghost-hover:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
  button-danger:
    backgroundColor: "{colors.red}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "7px 18px"
  card-surface:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.lg}"
    padding: "16px"
  chip-tag:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
---

# Design System: weeb.vip

## Overview

**Creative North Star: "The Broadcast Gallery"**

weeb.vip is a precision schedule desk standing inside a darkened gallery hung
with lit key art. Those are not two moods fighting; they are two jobs in one
room. The schedule half is instrumentation — times, episode numbers, countdowns
and status set in mono, aligned to a grid, read at a glance and trusted. The
gallery half is the catalogue — cover art and key art given real size, real
light, and real shadow, because the artwork is the only genuinely beautiful
material the product owns and hiding it behind chrome wastes it.

The ground is a near-black indigo (`oklch(14% 0.015 275)`), not neutral black.
Everything above it is built from four tonal steps of the same hue, so surfaces
separate by light rather than by outline. Against that ground, artwork reads as
the brightest thing on screen — which is the point. The violet accent behaves
like a cursor, not a coat of paint: it marks the one action that matters and the
one thing currently selected, and it appears nowhere else. Status lives in the
three signal colours (green airing, amber upcoming, red dropped/error), used as
indicators rather than decoration.

Depth is cinematic and directional. Cards and posters sit on soft, heavy
shadows cast downward (12–32px blur at 40% black; 20–60px for posters), and lift
on hover. Frosted glass over blurred key art carries the navigation and hero
overlays. The result should feel like a dimmed room where the screens are on,
not like a flat dashboard and not like a decorated one.

**Key Characteristics:**
- Dark-only, single-hue tonal ground (indigo-black, four steps)
- Artwork is the brightest element on any screen; the UI frames it
- Mono numerals for every time, count, and duration
- One accent, used like a cursor
- Cinematic downward shadows; hover lifts
- High information density with no ornament

## Colors

A single indigo hue family carries the entire surface stack; colour appears only
where it means something — an action, a selection, or a state.

### Primary
- **Signal Violet** (`--weeb-accent`): The one action colour. Primary CTAs, the
  active nav item, the selected filter, focus treatment. Used on roughly a tenth
  of any screen or less.
- **Signal Violet Lift** (`--weeb-accent-hover`): The hover step. Lighter and
  slightly more chromatic, so a hover reads as illumination rather than a
  different colour.

### Secondary
- **Signal Violet Text** (`--weeb-accent-text`): The accent at the lightness it
  needs to be *text* on a dark ground. The accent as a fill and the accent as a
  label are not the same value here: white on `--weeb-accent` is 5.07:1, so the
  fill must stay at 55%, while the same 55% used as a small label is only 3.93:1
  and fails AA. Use this for accent-coloured links and labels; never as a fill.
- ~~**Gallery Violet** (`--weeb-violet`)~~ and ~~**Gallery Violet Muted**~~ are
  **deprecated aliases** of `--weeb-accent-hover` and `--weeb-accent`. They were
  `oklch(62% 0.14 300)` and `oklch(45% 0.10 300)` — 20° from the old accent,
  which is too close to read as a separate role. Existing call sites still
  resolve; do not reach for them in new work.

### Tertiary — status signals
- **Airing Green** (`--weeb-green`): Currently airing, success, completed.
- **Upcoming Amber** (`--weeb-amber`): Upcoming, warning, scheduled.
- **Dropped Red** (`--weeb-red`): Error, danger, dropped.

### Neutral
- **Theatre Black** (`--weeb-bg`): The page ground. Near-black with an indigo
  cast, never pure `#000`.
- **Raised Black** (`--weeb-bg-elevated`): Modals, drawers, nav bars, and any
  region that must read as sitting above the page.
- **Screen Grey** (`--weeb-surface`): Cards, panels, inputs — the default
  surface for anything that holds content.
- **Screen Grey Lit** (`--weeb-surface-hover`): The hovered surface step.
- **Edge** (`--weeb-border`): Card borders and dividers. A hairline that
  separates without drawing.
- **Projection White** (`--weeb-fg`): Primary text. Warm-neutral, not pure white.
- **Half Light** (`--weeb-fg-secondary`): Supporting text, metadata, secondary
  labels — the majority of text on a dense screen.
- **Quarter Light** (`--weeb-fg-muted`): Placeholders, disabled text, and
  low-priority metadata. Raised from `55%` to `62%`: at 55% it measured 4.10:1 on
  the page ground and 3.88:1 on elevated surfaces, so it could not reach WCAG AA
  anywhere in the palette — and it carries the sub-line on every poster card.

### Named Rules

**The Hue-Separation Rule.** The accent must sit far enough from the ground's hue
to read as a different voice rather than a brighter tint of the page. The accent
was `oklch(55% 0.15 280)` against a `275` ground — five degrees — and it did not
carry. It is now `298`. Any future accent stays at least ~20° off the ground.

**The Cursor Rule.** The accent is the cursor of the interface. It marks exactly
one primary action and the current selection — nothing else. If two things on a
screen are accent-coloured and neither is the primary action, one of them is
wrong.

**The Art Is Brightest Rule.** Cover and key art must remain the brightest,
most saturated thing in any viewport. If a UI element out-saturates the artwork
beside it, tone the element down; never brighten the ground to compete.

**The Signal-Not-Decoration Rule.** Green, amber and red mean airing, upcoming
and dropped/error. They never appear for emphasis, variety, or category colour.

## Typography

**Display / Body Font:** the system sans stack (`-apple-system,
BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`) — chosen for speed and
native rendering, which is a product commitment, not a placeholder.
**Numeral / Mono Font:** JetBrains Mono (with `ui-monospace, Menlo, monospace`).

**Character:** Neutral and fast for prose, mechanical and tabular for anything
the schedule promises. The pairing does the North Star's work directly: the sans
recedes so artwork and titles carry the page, and the mono makes times and
episode counts look measured rather than written.

### Hierarchy
- **Display** (800, `clamp(28px, 4vw, 44px)`, 1.1, -0.02em): Hero and page
  titles only. One per screen.
- **Headline** (700, 20px, 1.25): Section headers — "Currently Airing", "This
  Season". The rail label above a row of art.
- **Title** (600, 15px, 1.35): Card titles, show names in lists, modal headings.
- **Body** (400, 14px, 1.6): Synopses and prose. Cap measure at 65–75ch.
- **Label** (600, 12px, 0.04em): Badges, chips, meta labels, small buttons.
- **Numeral** (JetBrains Mono, 500, 12px, 0.02em): Episode numbers, air times,
  countdowns, durations, runtimes, scores, dates.

### Named Rules

**The Mono Numeral Rule.** Every value the schedule is accountable for — air
time, countdown, episode number, episode count, duration, score, date — is set
in JetBrains Mono. Prose numbers inside a sentence stay in the sans. This is
what makes the timing look measured, and it is the typographic signature of the
system.

**The One Display Rule.** A screen gets one Display-sized element. A second one
means the hierarchy has collapsed and something should be Headline instead.

## Layout

A centred content column with responsive gutters driven by tokens:
`--weeb-section-px` steps 48px → 24px (≤1024px) → 16px (≤480px), and
`--weeb-section-py` steps 40px → 32px → 24px. The fixed nav is 60px
(`--weeb-nav-height`); page content offsets for it.

The homepage grammar is **full-screen banner, then rails**: a `100svh` hero
carrying the featured show and the schedule, followed by rows of poster cards
under Headline-sized section labels. The banner owns the whole first viewport by
design — nothing from the next section peeks above the fold. Poster cards hold a 2:3 aspect ratio
(`aspect-2/3`) and sit in a responsive grid on every surface, homepage included.

**The Single-Axis Rule.** Content scrolls down, never sideways. A horizontal
carousel inside a vertically scrolling page asks the reader to change gesture
axis to reach content, and on a phone it competes with the page scroll itself,
so everything past the second card goes unseen. This reverses an earlier rule
that specified horizontally scrolling rails at every breakpoint; the rails were
adopted to solve a page that ran to 5,098px on a phone, but the length was never
caused by the grid -- it was fourteen items in it, which at two columns is seven
rows per section. Cap the count per breakpoint and let "See all" own
completeness.

Density is deliberately high — a seasonal watcher checking what aired should see
the whole answer without scrolling twice. Vertical rhythm inside cards and
panels runs on 4px steps, with 16px as the default internal card padding and
`--weeb-section-py` separating major regions.

**The Full-Bleed Art Rule.** Hero and banner artwork runs edge to edge, ignoring
the section gutter. The gutter governs text and controls, never key art.

## Elevation & Depth

Hybrid, and both halves are load-bearing. **Tonal layering** establishes the
resting order: ground → elevated → surface → hovered surface, four steps of one
hue, no shadow required. **Shadows** are reserved for things that genuinely
float above the page or that are lifting in response to the user — posters,
cards on hover, dropdowns, modals. The shadows are large, soft and dark
(nothing under 24px total blur), so they read as a dim room's ambient falloff
rather than as a drop-shadow outline.

### Scrim

- **Scrim** (`--weeb-scrim`, `oklch(0% 0 0 / 0.88)`): The ground for small labels
  laid directly over cover art — score badges, counts, anything that must stay
  legible whatever the poster does. Key art is routinely near-white, and at 0.7
  alpha an amber score badge fell to 3.40:1 over it; 0.88 holds every backdrop
  from black to white.

### Shadow Vocabulary
- **Card** (`box-shadow: 0 12px 32px oklch(0% 0 0 / 0.4)`): Cards at rest in an
  art context, and any panel sitting over artwork.
- **Poster** (`box-shadow: 0 20px 60px oklch(0% 0 0 / 0.5)`): Hero posters and
  large key-art elements. The deepest shadow in the system.
- **Dropdown** (`box-shadow: 0 8px 24px oklch(0% 0 0 / 0.4)`): Menus, popovers,
  autocomplete panels, toasts.

### Frosted Glass

Two recipes. They are not interchangeable, and the difference is the area they
cover.

**Bar glass** — `--weeb-glass-bg` (`oklch(14% 0.015 275 / 0.82)`) with
`--weeb-glass-blur` (`blur(24px) saturate(1.4)`). For the navigation bar and
other thin strips. The saturation boost is intentional at this size: a 60px band
picks up a hint of the artwork's colour and reads as glass rather than as a grey
plate.

**Panel glass** — `--weeb-panel-bg` (`oklch(22% 0.02 275 / 0.90)`) with
`--weeb-panel-blur` (`blur(28px) saturate(0.9)`). For any panel large enough to
hold a block of content over artwork. Three deliberate differences from the bar:
the tint comes from `--weeb-surface`, not the page ground, so the panel stays
lighter than dark key art instead of vanishing into it; the alpha is higher, so
a third less artwork bleeds through; and the saturation is pulled **below** one,
so busy artwork reads as calm texture rather than chroma noise.

**The Glass-By-Area Rule.** Bar glass on a large panel fails at both ends of the
catalogue: it disappears against near-black key art, and `saturate(1.4)`
amplifies neon key art into mud. Anything bigger than a strip takes panel glass.
Panel glass bounds its own contrast — the ground can only range between
`rgb(22,23,32)` over black art and `rgb(47,49,58)` over white — so text on it is
predictable rather than dependent on whichever show is featured.

**The Lift-On-Intent Rule.** A shadow deepening or a surface stepping lighter is
a response to the user's intent (hover, focus, open). Nothing gains elevation
just to look important at rest.

## Shapes

Soft rectangles throughout, with radius carrying scale: 4px for chips and small
controls, 8px for the default card, input and button, 12px for large cards and
modals, 20px for genre/tag pills, and full-round for avatars and dots. Corners
are the only form gesture; there is no angular clipping, no diagonal cut, no
decorative shape language.

Borders are hairlines in `--weeb-border`, used to define an edge where tonal
separation alone is too subtle — typically a surface sitting on a surface. Over
artwork, the shadow does the separating and the border is dropped.

Poster and key-art frames hold a 2:3 ratio and clip to the card radius, so the
artwork itself takes on the system's corner language.

## Components

### Buttons
- **Shape:** 8px radius (`--weeb-radius`), 7px × 18px padding, 14px/600 label
  (the Body step; the frontmatter previously pointed at Label while this line said
  13px, and neither matched the other),
  inline-flex, no border on filled variants.
- **Primary:** `--weeb-accent` ground, white label. Hover steps to
  `--weeb-accent-hover`; 0.15s transition on background, colour and border.
- **Ghost:** transparent ground, `--weeb-fg-secondary` label, 1px
  `--weeb-border`. Hover fills to `--weeb-surface` and lifts the label to
  `--weeb-fg`.
- **Danger:** `--weeb-red` ground, white label; hover brightens 1.1.
- **States:** buttons carry inline idle/loading/success/error status (spinner,
  check, alert) that auto-resets after 2s. Disabled drops to 0.5 opacity.

### Chips / Genre pills
- **Style:** `--weeb-surface` ground, `--weeb-fg-secondary` label at Label
  scale, pill radius (20px), 6px × 14px padding.
- **State:** selected chips take the accent as ground with white label. Chip
  rows scroll horizontally; they never wrap.

### Cards / Containers
- **Corner:** 8px default, 12px for large cards and modals.
- **Background:** `--weeb-surface` on the page ground; `--weeb-bg-elevated` when
  inside an already-elevated region.
- **Shadow:** card shadow in art contexts, none for plain list surfaces at rest.
- **Border:** 1px `--weeb-border` where tonal separation is insufficient;
  dropped when the card sits over artwork.
- **Padding:** 16px internal default.

### Inputs / Fields
- **Style:** `--weeb-surface` ground, 8px radius, 1px `--weeb-border`,
  `--weeb-fg` text, `--weeb-fg-muted` placeholder, 10px × 14px padding.
- **Focus:** border shifts to `--weeb-accent` with a soft accent ring; never a
  browser default outline, never a glow large enough to read as a shadow.
- **Error:** border and helper text in `--weeb-red`.

### Navigation
- **Style:** fixed, 60px tall, bar glass over whatever it covers.
- **States:** default `--weeb-fg-secondary`; hover `--weeb-fg`; active item
  carries the accent (label or underline, not both).
- **Mobile:** collapses to a drawer (`MobileDrawer`) over `--weeb-bg-elevated`.
- **Overlay mode:** on surfaces that run artwork under the bar, the bar takes an
  `overlay` flag resolved from the route during SSR, so there is no flash of the
  solid bar on hydration. Ground, blur, border and label colour all derive from
  one `--nav-solid` value between 0 and 1. Every label — including the
  right-hand cluster and the search field — rides to full `--weeb-fg` while over
  artwork and settles back to its resting colour as the glass arrives; secondary
  grey clears only ~2.4:1 against pale key art. Filled buttons keep their own
  label colour.
- **Overlay motion:** scroll sets a target and a `requestAnimationFrame` loop
  eases the rendered value toward it. Mapping the value directly off `scrollY`
  is not enough: scroll events do not arrive one per frame, and a single wheel
  tick can move `scrollY` 200px in one event, which snaps the bar in.

### Poster card (signature)
A 2:3 clipped poster with an optional score badge and a status dot. The title
sits below the art at Title scale; the sub-line (episode, season, or air time)
sits under it in mono at Numeral scale. At rest the card is the artwork; the
metadata is quiet. On hover the card lifts, its shadow deepens toward the poster
shadow, and the surface steps to `--weeb-surface-hover`.

### Airing strip card (legacy)
Superseded on the homepage by the hero airing rail above, and retained for the
schedule surfaces. The horizontal counterpart used in an airing rail: small clipped art on the
left, title and episode text stacked to the right, air time or "2h ago" in mono,
and a live indicator in `--weeb-green` when a show is airing now. This card is
where the schedule promise is most visible; timing text never drops below Label
legibility, and the live dot is the only animated element permitted on it.

### Hero banner (signature)
Full-screen key art (`100svh`) starting at the top of the document, running
under a transparent bar. The artwork is unshaded except at the two edges.

- **Top scrim** — a short downward gradient behind the bar. Required: it is what
  makes a transparent bar safe over key art of unknown colour.
- **Content panel** — title, badge, meta line and up to two actions in a panel
  on panel glass, bottom-left. The panel is what keeps text legible; there is no
  bottom scrim behind it.
- **Airing rail** — the schedule panel, matched to the content panel (see
  below).
- **Fade band** — a band below the fold where the artwork dissolves into the
  page ground, so the banner does not end on a hard cut. Sized to sit entirely
  below the fold: nothing of it shows at rest, and it is only revealed by
  scrolling. Eased on a smoothstep ramp — a linear two-stop gradient begins
  fading at constant slope and the eye reads that onset as a horizontal seam.

**The Legible-Ground Rule.** Text over artwork needs a ground the artwork cannot
change: a scrim, or a panel. Which one is a composition decision; having neither
is not an option, and a fade tuned against one show's key art is not a ground.

**Length-stepped display.** Show titles run from eight characters to fifty. The
hero title steps its size down by title length so long ones do not run to three
lines and shove the panel's top edge up as the banner retargets. Computed during
render, so SSR emits the final size and there is no measure-then-resize flash.

### Hero airing rail (signature)
The schedule as a panel inside the banner: vertical on desktop, a horizontally
scrolling tray across the base on mobile. Carries episode, local air time,
countdown and live state. Entries are links, and hovering or focusing one
retargets the banner behind it, with the current entry marked. Rendered as a
sibling of the keyed banner so it does not remount on selection and lose
keyboard focus.

## Do's and Don'ts

### Do:
- **Do** reference tokens (`var(--weeb-*)` in scoped styles, `weeb-*` in
  Tailwind) rather than literal colour values.
- **Do** set every air time, countdown, episode number, count, duration, score
  and date in JetBrains Mono at Numeral scale.
- **Do** let cover and key art run full-bleed and be the brightest thing in the
  viewport.
- **Do** give any text laid over artwork a ground the artwork cannot change:
  a scrim, or a panel on panel glass.
- **Do** use panel glass, not bar glass, for anything larger than a thin strip.
- **Do** separate resting surfaces by tonal step first, and add a hairline
  `--weeb-border` only when the step alone is too subtle.
- **Do** reserve shadows for elements that float or are responding to intent,
  using the three named shadow tokens.
- **Do** keep green, amber and red bound to airing, upcoming and
  dropped/error.

### Don't:
- **Don't** use `dark:` Tailwind prefixes or add a light theme. There is no
  light mode.
- **Don't** hardcode `oklch()` values in components.
- **Don't** introduce a new hue, a new font family, or a gradient of two
  arbitrary colours. The palette is one violet accent over an indigo-black
  ground, plus three signals. A gradient inside a single hue's tonal ramp is
  fine; two hues blended is not.
- **Don't** spend the accent on more than the primary action and the current
  selection on a given screen.
- **Don't** put a shadow under a flat resting list surface, or use a shadow with
  less than 24px total blur.
- **Don't** let a UI element out-saturate the artwork next to it.
- **Don't** introduce a horizontally scrolling carousel of content. Grids scroll
  with the page. The one exception is the hero's airing rail on mobile, which is
  a fixed schedule strip rather than a browse surface.
- **Don't** put more than one Display-scale element on a screen.
- **Don't** add social, feed, forum, or review affordances — they are outside
  the product's scope, and no visual pattern for them exists here.
