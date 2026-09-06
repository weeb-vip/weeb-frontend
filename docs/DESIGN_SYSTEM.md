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

Two heights, and only two. `ChipGroup` reaches the taller one with
`size="touch"` — which is what the season strips and the homepage tag row use.

### Count badge

One treatment, `Chip`'s: mono, tabular numerals, on `--weeb-surface-hover`,
tinted with the chip's own colour while it is selected, and transparent at `0`
so an empty facet recedes.

| Token | Value |
|---|---|
| `--weeb-pill-count-radius` | `var(--weeb-radius-full)` |
| `--weeb-pill-count-padding` | 2px 6px |
| `--weeb-pill-count-font-size` | 10px |
| `--weeb-pill-count-min-width` | 18px |

---

## Severity tints

One recipe for "this box carries a status colour", derived from the status
token itself. Never mix a fresh one, and never write the alpha stops by hand:
`AnimeToast` used to hardcode `oklch(62% 0.17 145 / 0.1)` where `--weeb-green`
is `oklch(65% 0.15 155)`, which put two green palettes inside one toast stack.

| Stop | Token | Value | Usage |
|---|---|---|---|
| Ground | `--weeb-<hue>-tint` | the hue at 12% | The box's own background |
| Hairline | `--weeb-<hue>-edge` | the hue at 45% | Its border, or a ring |
| Ring | `--weeb-<hue>-ring` | the hue at 20% | A 3px focus glow (accent, red) |

`<hue>` is `accent`, `red`, `amber` or `green`. Three surfaces express the same
severities three ways and all three read from these: `ErrorBanner` as a tinted
box, `AnimeToast` as a tinted indicator ring, `GlobalToaster` as a 3px rule down
the toast's leading edge. Which shape is right depends on what the surface
already is -- a toast is a card already, so it takes the edge, not a full tint.

---

## Destructive actions

Red is not one treatment. Which one is right is decided by where the decision
is being made, not by how bad it is:

| Context | Treatment | Example |
|---|---|---|
| A committed action in a form or dialog footer | Filled red `Button` | Delete account |
| A row in a menu | Red **text**, `--weeb-red-tint` on hover | "Remove from list" in `AnimeStatusDropdown` |
| A row that only turns red under the pointer | Neutral at rest, `--weeb-red` on hover/focus | Sign out in `MobileDrawer` |
| Something that already failed | `ErrorBanner severity="error"` | An upload that did not go through |

A menu row is never a filled red button: a menu is a list of peers, and filling
one of them makes the destructive option the most salient thing on screen --
which is the opposite of what a destructive option should be. Equally, a failure
box is never a hand-mixed red: it is `ErrorBanner`, which owns the 12%/45% pair.

---

## Shadows

| Token | Value |
|---|---|
| `--weeb-shadow-card` | `0 12px 32px oklch(0% 0 0 / 0.4)` |
| `--weeb-shadow-poster` | `0 20px 60px oklch(0% 0 0 / 0.5)` |
| `--weeb-shadow-dropdown` | `0 8px 24px oklch(0% 0 0 / 0.4)` |

---

## Layering

Every floating surface takes a layer token for what it **is**. There is no
sixth number: five surfaces choosing their own gave 50, 70, 150, 200 and a 9999
that put a status menu above the modal layer.

| Token | Value | Surface |
|---|---|---|
| `--weeb-z-dropdown` | 50 | Menus anchored to a control: `Select`, `AnimeStatusDropdown`, `ProfileDropdown` |
| `--weeb-z-popover` | 60 | Anchored panels that outrank a menu: `AnimeCalendarPopover` |
| `--weeb-z-drawer` | 100 | `MobileDrawer` -- over the page, under a dialog, so the login modal can open from inside it |
| `--weeb-z-modal` | 200 | The modal backdrop and its card |
| `--weeb-z-toast` | 300 | The toast stack. A report on what you just did has to be readable over whatever is on top, including a dialog |

---

## The floating surface

One recipe, one class: `.weeb-floating` in `design-tokens.css`.

```css
background: var(--weeb-surface);
border: 1px solid var(--weeb-border);
border-radius: var(--weeb-radius-lg);
box-shadow: var(--weeb-shadow-dropdown);
```

Every menu, popover, toast and dialog card composes it -- there used to be four
shadows and three radii across seven surfaces. `.weeb-floating--dialog` is the
same recipe on `--weeb-bg-elevated`, and exists for exactly one reason: a dialog
card is the only floating surface that CONTAINS form fields, whose own ground is
`--weeb-surface` and which would otherwise vanish into it.

`.weeb-overlay-backdrop` is the other half of a dialog -- fixed inset,
`--weeb-overlay-scrim`, `--weeb-overlay-blur`. `Modal` and `MobileDrawer` both
use it; they used to spell the same two values out separately.

---

## The form field

44px tall, `--weeb-radius`, 15px text, a 1.5px border. The recipe is
`.weeb-form-*` in `design-tokens.css`, not inside `FormInput`, because three
components draw the same field: `FormInput`, `FormTextarea` (the same field
given more than one line) and `Select` with `variant="field"`. When `FormInput`
owned the rules privately, the settings form grew a 42px/`rounded-md`/16px/1px
`<select>` and a 6px/16px `<textarea>` beside it -- three field languages in one
form.

An icon belongs **inside** the field (`icon` on `FormInput` or `Select`), never
in the label beside it.

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
| `tintAtRest` | boolean | `true` tints border, text and ground at rest (a chip that STATES something). `false` leaves the chip neutral until selected, colouring only the dot and the wash |
| `ghost` | boolean | Transparent ground, with the hover tinted from the chip's own colour. What a row you switch on and off sits on |
| `dot` | boolean | A leading dot in the chip's own colour |
| `count` | number | The shared count badge. `0` renders, muted |
| `mono` | boolean | Mono tabular numerals |
| `leading` | Snippet | An icon before the label |

### ChipGroup

**The** row. Every selectable or linked strip in the app is this component: it
replaced `Tabs` (single-select, three skins), `FilterPills` (multi-select) and
`ChipRow` (links), which each re-declared the pill off the same `--weeb-pill-*`
tokens `Chip` already owns. The item is always a `Chip`, so the `pill` variant
adds no shape at all — only the row gap.

Two skins, and the split is by what the row *is*, not by how many answers it
takes. `pill` is every row that picks: the genre facets, the news categories,
the mode switches, the season and year strips. `underline` is the tab bar
across the top of the thing it filters.

There was a third, `segmented` — a grey container round the row, a solid accent
fill on the selected chip, an 8px radius — doing single-select in a second
visual language. It merged into `pill`, and pill's treatment is the one that
survived for two reasons. A multi-select row has several chips on at once, and
a solid fill there is a run of loud blocks, where one tinted chip among
outlines reads the same at one selection or six; only pill could serve both
selection modes. And the container only ever held together while the items did
not wrap, which is why /search's 16-genre row could never be given one. The
cost is that a two-option switch (Grid | List) is two separate chips rather
than one joined control — accepted, because one language beats a joined look.

| Prop | Type | Description |
|---|---|---|
| `items` | `ChipGroupItem[]` | `{ value?, label, count?, icon?, title?, disabled?, accent?, href? }`. `value` defaults to `label` |
| `select` | `single \| multi \| none` | One at a time, any number, or a row that selects nothing (links) |
| `variant` | `pill \| underline` | `Chip` as drawn — every row that picks; or the underlined tab bar |
| `value` | string | `single`: the selected item's `value` |
| `isSelected` | `(value) => boolean` | `multi`: whether a chip is on. A predicate, so a `Set` caller needs no accessor |
| `onSelect` | `(value) => void` | A chip was activated |
| `mode` | `tabs \| toggle` | `single` only: a real tablist (arrow keys, one tab stop) or a group of buttons |
| `activeMarker` | `pressed \| current` | `toggle` only: `aria-pressed` for a mode switch, `aria-current="page"` for a strip that NAVIGATES |
| `size` | `sm \| md \| touch` | 11px dense, 12px default, or the 44px target |
| `tone` | `ChipTone` | Applied to every chip, for a row that states rather than selects |
| `iconOnly` | boolean | Hides labels. Each item then needs a `title` |
| `nowrap` | boolean | Keeps the row on one line and scrolls it sideways instead of wrapping. For a strip that is the page's spine — the season and year strips |
| `clear` | `{ label?, onClear }` | The leading Clear chip. Pass it only while something is on |
| `more` | `{ hiddenCount, expanded, onToggle, collapseLabel? }` | The "+N more" chip. No `collapseLabel` makes the reveal one-way |
| `ariaLabel` | string | Names the row |
| `itemContent` | `Snippet<[item]>` | Full control of a chip's contents — the inline SVGs the pages use |
| `class` / `itemClass` | string | Extra classes on the row / on every chip. The clear and more chips also get `<itemClass>--clear` / `--more` |

The homepage's "Browse by Tag" row is `select="none"` over `$lib/data/genres`.
The genre taxonomy is data; a presentational primitive does not own it.

An item's `accent` is what lets the news categories tell four colours apart
while staying one chip: it draws the leading dot and tints the selected wash,
and leaves the resting chip neutral.

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
| `children` | Snippet | Button text |
| `icon` | string/component | Optional icon |
| `status` | string | Optional status indicator |
| `disabled` | boolean | Disabled state |

### Modal

The dialog. Content-only children, wrapped: `LoginRegisterModal` and
`ProfileImageUpload` render a body and let this own the backdrop, the layer, the
portal, the focus trap, Escape and the page pin -- all of which come from the
`dialogSurface` action it shares with `MobileDrawer`.

| Prop | Type | Description |
|---|---|---|
| `isOpen` | boolean | |
| `size` | `sm \| md \| lg` | 440 / 560 / 720. `sm` is a form, `lg` is something you work inside |
| `showCloseButton` | boolean | The corner dismiss |
| `backdropCloseable` | boolean | Off for a dialog that must be dismissed deliberately |
| `className` | string | Extra classes. NOT a way to set the width -- that is `size` |
| `onClose` | `() => void` | Asked to dismiss, by any of the three routes |

### Select

The select that does not open a white OS menu on a dark page.

| Prop | Type | Description |
|---|---|---|
| `value` | string/number | Bindable |
| `options` | `{ value, label }[]` | |
| `variant` | `pill \| field` | The 32px filter control, or the 44px form field |
| `icon` | `IconDefinition` | A leading icon inside the control |
| `placeholder` | string | Shown when nothing matches `value` |
| `align` | `left \| right` | Which edge the menu lines up with |
| `disabled` | boolean | |
| `onChange` | `({ value }) => void` | Fires on commit, not while arrowing |

### FormTextarea

`FormInput` with more than one line, off the same `.weeb-form-*` recipe. A
`maxlength` caps the value and turns on the character count under the field.

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
   Status tints come from the `-tint` / `-edge` / `-ring` tokens, not from a
   fresh `color-mix` and never from a literal `oklch()`.
7. **Take the layer token, not a number** — `--weeb-z-*` is the whole scale.
8. **Compose the recipe, not the tokens** — `.weeb-floating`,
   `.weeb-overlay-backdrop` and `.weeb-form-*` exist so a surface is drawn once.
   Reusing the tokens is not the same as reusing the rule.
9. **Focus is visible everywhere.** `base.scss` sets a 2px accent ring as the
   floor. A component may author a better one (`FormInput`'s 3px glow); it may
   not author `outline: none` and put a 1px border-colour change in its place.
10. **Disabled is `opacity: 0.5`** — one value, everywhere.
