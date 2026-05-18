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
| `--weeb-radius-full` | 9999px | Avatars, circles |
| _(hardcoded)_ | 20px | Genre pills |

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

Poster grid card with score badge and status indicator.

| Prop | Type | Description |
|---|---|---|
| `id` | number/string | Anime ID |
| `title` | string | Display title |
| `image` | string | Poster image URL |
| `score` | number | Score badge value |
| `status` | string | Airing status |
| `sub` | string | Subtitle line |
| `href` | string | Link target |

### AiringStripCard

Horizontal compact card for the airing strip carousel.

| Prop | Type | Description |
|---|---|---|
| `id` | number/string | Anime ID |
| `title` | string | Display title |
| `image` | string | Poster image URL |
| `episodeText` | string | e.g. "Ep 12" |
| `timeText` | string | e.g. "2h ago" |
| `isLive` | boolean | Currently airing indicator |

### SectionHeader

Section title with an optional "View all" link.

| Prop | Type | Description |
|---|---|---|
| `title` | string | Section heading text |
| `href` | string | Optional link URL |
| `linkText` | string | Optional link label |

### GenrePills

Horizontally scrolling genre pill list.

| Prop | Type | Description |
|---|---|---|
| `genres` | string[] | List of genre names |

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

### AnimeCard

Detail card with full metadata display.

| Prop | Type | Description |
|---|---|---|
| `id` | number/string | Anime ID |
| `title` | string | Display title |
| `image` | string | Poster image URL |
| `description` | string | Synopsis text |
| `episodes` | number | Episode count |
| `year` | number | Release year |
| `tags` | string[] | Genre/tag list |

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
