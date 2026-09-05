# weeb.vip Design System

## Overview

weeb.vip is an anime tracking platform. The UI is **dark theme only** — there is no light mode. Typography uses the system sans-serif stack. The primary accent is an indigo/violet pulled from the logo.

All design tokens live in `src/styles/design-tokens.css` and use **oklch()** for perceptual uniformity. Do NOT hardcode oklch values in components — always reference the CSS custom properties.

---

## Color Tokens

All values are `oklch()`. Reference via `var(--weeb-*)` in scoped styles or `weeb-*` in Tailwind utilities.

### Backgrounds

| Token | Value | Usage |
|---|---|---|
| `--weeb-bg` | `oklch(14% 0.015 275)` | Page background |
| `--weeb-bg-elevated` | `oklch(18% 0.018 275)` | Elevated regions (modals, drawers) |

### Surfaces (cards, panels, inputs)

| Token | Value | Usage |
|---|---|---|
| `--weeb-surface` | `oklch(22% 0.02 275)` | Card / panel background |
| `--weeb-surface-hover` | `oklch(26% 0.022 275)` | Hovered card / interactive surface |

### Borders

| Token | Value | Usage |
|---|---|---|
| `--weeb-border` | `oklch(28% 0.015 275)` | Card borders, dividers |

### Foreground / Text

| Token | Value | Usage |
|---|---|---|
| `--weeb-fg` | `oklch(95% 0.005 265)` | Primary text |
| `--weeb-fg-secondary` | `oklch(70% 0.01 270)` | Secondary / supporting text |
| `--weeb-fg-muted` | `oklch(55% 0.01 270)` | Disabled text, placeholders |

### Accent

| Token | Value | Usage |
|---|---|---|
| `--weeb-accent` | `oklch(55% 0.15 280)` | Primary CTA, active states |
| `--weeb-accent-hover` | `oklch(62% 0.16 280)` | Hovered accent |
| `--weeb-violet` | `oklch(62% 0.14 300)` | Secondary highlights, badges |
| `--weeb-violet-muted` | `oklch(45% 0.10 300)` | Subtle violet tints |

### Status Colors

| Token | Value | Usage |
|---|---|---|
| `--weeb-green` | `oklch(65% 0.15 155)` | Airing, success, completed |
| `--weeb-amber` | `oklch(72% 0.14 85)` | Upcoming, warning |
| `--weeb-red` | `oklch(60% 0.18 25)` | Error, danger, dropped |

---

## Typography

### Font Stacks

| Token | Value |
|---|---|
| `--weeb-font` | `-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif` |
| `--weeb-font-mono` | `'JetBrains Mono', ui-monospace, Menlo, monospace` |

### Type Scale

| Context | Size | Weight |
|---|---|---|
| Hero h1 | `clamp(28px, 4vw, 44px)` | 800 |
| Section h2 | 20px | 700 |
| Body text | 14-15px | 400 |
| Labels / badges | 11-13px | 500-600 |

---

## Spacing

### Section Padding

| Token | Default | <= 1024px | <= 480px |
|---|---|---|---|
| `--weeb-section-px` | 48px | 24px | 16px |
| `--weeb-section-py` | 40px | 32px | 24px |

### Nav

| Token | Value |
|---|---|
| `--weeb-nav-height` | 60px |

---

## Border Radius

| Token | Value | Usage |
|---|---|---|
| `--weeb-radius` | 8px | Default (cards, inputs) |
| `--weeb-radius-lg` | 12px | Large cards, modals |
| `--weeb-radius-sm` | 4px | Small elements, chips |
| `--weeb-radius-full` | 9999px | Avatars, circles, pills |

Reference these **bare** — `var(--weeb-radius)`, never `var(--weeb-radius, 8px)`.
This file is imported globally, so a fallback can never fire; every one of the
~100 that existed was dead code, and they had drifted (`--weeb-radius-full`
written as `9999px`, `999px` and once as `20px`; `--weeb-radius-sm` as `4px`,
`6px` and `8px`). That `20px` is why the pills used to disagree about their own
shape.

---

## Pills

There is **one** pill, and it is a component: `primitives/Chip.svelte`. It is
the ONLY file that reads the `--weeb-pill-*` tokens. Anything pill-shaped —
a genre link, a quick-info fact, a type badge, a news category, a voice-actor
credit — composes `Chip` rather than re-declaring the shape off the same
tokens, because five agreeing copies of a rule are still five copies.

`Chip` renders as an `<a>` given an `href`, a `<button>` given an `onclick`,
and a `<span>` otherwise, which is what lets the link row and the static badge
be the same component.

| Token | Value | Usage |
|---|---|---|
| `--weeb-pill-radius` | `var(--weeb-radius-full)` | The pill's own radius |
| `--weeb-pill-padding-y` / `-x` | 6px / 14px | Pill padding |
| `--weeb-pill-gap` | 6px | Between a pill's parts (dot, label, count) |
| `--weeb-pill-row-gap` | 8px | Between pills in a row |
| `--weeb-pill-font-size` | 12px | |
| `--weeb-pill-font-weight` | 600 | |
| `--weeb-pill-min-height` | 32px | Dense filter rows |
| `--weeb-pill-min-height-touch` | 44px | A strip that is a page's primary way through it |

Two heights, and only two. `Tabs` reaches the taller one with `size="touch"` —
which is what the season strips and the homepage tag row use.

### Count badge

One treatment, shared by `Tabs` and `FilterPills`: mono, tabular numerals, on
`--weeb-surface-hover`, tinted with the accent while its pill is selected, and
transparent at `0` so an empty facet recedes.

| Token | Value |
|---|---|
| `--weeb-pill-count-radius` | `var(--weeb-radius-full)` |
| `--weeb-pill-count-padding` | 2px 6px |
| `--weeb-pill-count-font-size` | 10px |
| `--weeb-pill-count-min-width` | 18px |

---

## Shadows

| Token | Value |
|---|---|
| `--weeb-shadow-card` | `0 12px 32px oklch(0% 0 0 / 0.4)` |
| `--weeb-shadow-poster` | `0 20px 60px oklch(0% 0 0 / 0.5)` |
| `--weeb-shadow-dropdown` | `0 8px 24px oklch(0% 0 0 / 0.4)` |

## Overlay / Frosted Glass

| Token | Value |
|---|---|
| `--weeb-glass-bg` | `oklch(14% 0.015 275 / 0.82)` |
| `--weeb-glass-blur` | `blur(24px) saturate(1.4)` |

---

## Components

### PosterCard

Poster grid card. Composes `Score` (badge), and either `StatusMarker` (on the
viewer's list) or `AiringIndicator` (where it is in its run) in the corner
opposite — one at a time, never both.

| Prop | Type | Description |
|---|---|---|
| `id` | number/string | Anime ID |
| `title` | string | Display title |
| `image` | string | Poster image URL |
| `score` | number | Score badge value |
| `status` | string | Airing status |
| `sub` | string | Subtitle line |
| `href` | string | Link target |

### Chip

**The** pill. Every small labelled thing is this component.

| Prop | Type | Description |
|---|---|---|
| `label` | string | The text. `children` wins over it |
| `href` | string | Renders an `<a>` |
| `onclick` | `() => void` | Renders a `<button>`. Neither renders a `<span>` |
| `tone` | `neutral \| accent \| green \| amber \| red` | Tints border, text and ground from one colour |
| `color` | string | An explicit tint for an OPEN set the tones cannot name (news categories). A token reference, never a raw oklch |
| `size` | `sm \| md` | 11px dense metadata, or 12px (the pill token) |
| `touch` | boolean | The taller of the two heights |
| `selected` | boolean | The accent wash |
| `dot` | boolean | A leading dot in the chip's own colour |
| `count` | number | The shared count badge. `0` renders, muted |
| `mono` | boolean | Mono tabular numerals |
| `leading` | Snippet | An icon before the label |

### ChipRow

A wrapping row of `Chip`s, at `--weeb-pill-row-gap`.

| Prop | Type | Description |
|---|---|---|
| `items` | `{ label, href?, title? }[]` | |
| `tone` / `size` / `touch` | | Applied to every chip |
| `ariaLabel` | string | Names the row |

The homepage's "Browse by Tag" row is this over `$lib/data/genres`. The genre
taxonomy is data; a presentational primitive does not own it.

### Score

A rating. One star glyph, mono tabular numerals.

| Prop | Type | Description |
|---|---|---|
| `value` | number/string/null | |
| `variant` | `badge \| inline` | Over cover art on a scrim, or in a text row |
| `placeholder` | string | `inline` only; a `badge` with no score does not render |

### StatusMarker

The corner ribbon saying a show is on the viewer's list. Wordless, colour-coded
from `STATUS_COLORS`, with the glyph carrying the status. Sits in whatever
positioned box the caller gives it.

| Prop | Type | Description |
|---|---|---|
| `status` | string | A raw list status; anything unrecognised renders nothing |

### AiringIndicator

"On the air". **Green is airing, amber is upcoming**, and the pulse only ever
runs on the green one.

| Prop | Type | Description |
|---|---|---|
| `state` | `airing \| upcoming` | |
| `presentation` | `dot \| chip` | The bare marker, or `Chip` with the dot inside |
| `label` | string | Chip only |
| `pulse` | boolean | Off where the motion would be noise; always off under `prefers-reduced-motion` |

### SectionHeader

Section title with an optional "View all" link. Three scales, one
implementation — `ShowSection` and `RelatedAnime` used to write their own.

| Prop | Type | Description |
|---|---|---|
| `title` | string | Section heading text |
| `size` | `section \| sub \| eyebrow` | 20px shelf, 18px show-page section, 12px uppercase group label |
| `as` | `h2 \| h3` | Heading level |
| `rule` | boolean | The hairline from the words to the column edge |
| `id` | string | For `aria-labelledby` |
| `href` / `linkText` | string | Optional trailing link |

### FilterPills

One **multi-select** filter row — pills that turn on and off independently, with
optional counts, an optional leading "Clear" and an optional trailing
"+N more". The sibling of `Tabs`, which is single-select; reach for that one when
exactly one item can be picked.

| Prop | Type | Description |
|---|---|---|
| `items` | `FilterPillItem[]` | `{ value, label, count? }` |
| `isSelected` | `(value) => boolean` | Whether a pill is on |
| `onToggle` | `(value) => void` | |
| `clear` | `{ label?, onClear }` | The leading Clear pill. Pass it only while something is on |
| `more` | `{ hiddenCount, expanded, onToggle, collapseLabel? }` | The "+N more" pill. No `collapseLabel` makes the reveal one-way |
| `ariaLabel` | string | Names the row |
| `class` / `pillClass` | string | Extra classes on the row / on every pill |

### HeroBanner

Full-width hero with blurred anime background, badges, title, action buttons, and poster overlay.

| Prop | Type | Description |
|---|---|---|
| `anime` | object | Anime data object (title, image, genres, score, etc.) |

### Button

Action button with color variants.

| Prop | Type | Description |
|---|---|---|
| `color` | `'blue' \| 'red' \| 'transparent'` | Button color variant |
| `label` | string | Button text |
| `icon` | string/component | Optional icon |
| `status` | string | Optional status indicator |
| `disabled` | boolean | Disabled state |

### SafeImage

Progressive image loader with placeholder and fallback support.

| Prop | Type | Description |
|---|---|---|
| `src` | string | Primary image URL |
| `sources` | string[] | Alternate sources |
| `alt` | string | Alt text |
| `fallbackSrc` | string | Fallback image URL |
| `className` | string | Additional CSS classes |

### Footer

Simple one-line footer with copyright text and navigation links.

---

## Tailwind Integration

Design tokens are available as Tailwind utilities:

```
bg-weeb-bg, bg-weeb-surface, bg-weeb-accent ...
text-weeb-fg, text-weeb-fg-secondary, text-weeb-accent ...
border-weeb-border, border-weeb-accent ...
```

For new components, prefer scoped `<style>` blocks using `var(--weeb-*)` directly. Use Tailwind utilities for layout (flex, grid, spacing) and token-mapped classes for color.

---

## Usage Rules

1. **Always dark theme** — never use `dark:` prefixed classes; there is no light mode.
2. **Use tokens, not raw values** — `var(--weeb-*)` in scoped styles, `weeb-*` in Tailwind utilities.
3. **One accent color** (`--weeb-accent`) — used sparingly for CTAs and active states.
4. **Violet for secondary highlights** (`--weeb-violet`) — badges, tags, decorative accents.
5. **Status color mapping:**
   - Green (`--weeb-green`) — airing, success, completed
   - Amber (`--weeb-amber`) — upcoming, warning
   - Red (`--weeb-red`) — error, danger, dropped
6. **Do not hardcode oklch values** — always reference the CSS custom properties.
