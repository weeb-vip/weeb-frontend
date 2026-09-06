import type { Meta, StoryObj } from '@storybook/svelte';
import { createRawSnippet } from 'svelte';
import { faList, faTableCells, faCalendarDays } from '@fortawesome/free-solid-svg-icons';
import ChipGroup from './ChipGroup.svelte';
import type { ChipGroupItem } from './ChipGroup.logic';
import { BROWSE_GENRE_LINKS } from '$lib/data/genres';

const STATUS_TABS: ChipGroupItem[] = [
  { value: 'watching', label: 'Watching', count: 14 },
  { value: 'completed', label: 'Completed', count: 132 },
  { value: 'planned', label: 'Plan to Watch', count: 61 },
  { value: 'onhold', label: 'On Hold', count: 0 },
  { value: 'dropped', label: 'Dropped', count: 0 },
];

const VIEW_TABS: ChipGroupItem[] = [
  { value: 'list', label: 'List view', icon: faList, title: 'List view' },
  { value: 'grid', label: 'Grid view', icon: faTableCells, title: 'Grid view' },
];

const GENRES: ChipGroupItem[] = [
  { value: 'Action', label: 'Action', count: 4821 },
  { value: 'Adventure', label: 'Adventure', count: 3140 },
  { value: 'Comedy', label: 'Comedy', count: 2977 },
  { value: 'Drama', label: 'Drama', count: 1866 },
  { value: 'Fantasy', label: 'Fantasy', count: 1502 },
  { value: 'Romance', label: 'Romance', count: 988 },
  { value: 'Sci-Fi', label: 'Sci-Fi', count: 741 },
  { value: 'Slice of Life', label: 'Slice of Life', count: 612 },
];

const TAGS: ChipGroupItem[] = [
  { value: 'Shounen', label: 'Shounen', count: 42 },
  { value: 'Mecha', label: 'Mecha', count: 18 },
  { value: 'Isekai', label: 'Isekai', count: 15 },
  { value: 'Sports', label: 'Sports', count: 9 },
  { value: 'Historical', label: 'Historical', count: 4 },
  { value: 'Josei', label: 'Josei', count: 0 },
];

/** Selection is the caller's state, so each story hands in a fixed answer. */
const someSelected =
  (...wanted: string[]) =>
  (value: string) =>
    wanted.includes(value);

/** The pages use inline SVGs rather than FontAwesome; `itemContent` is how they keep them. */
const svgItem = createRawSnippet((item: () => ChipGroupItem) => ({
  render: () =>
    item().value === 'schedule'
      ? `<span style="display:inline-flex;align-items:center;gap:6px;">
           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/></svg>
           Schedule
         </span>`
      : `<span style="display:inline-flex;align-items:center;gap:6px;">
           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
           Calendar
         </span>`,
}));

/**
 * THE row of chips: `Tabs`, `FilterPills` and `ChipRow` are all this one
 * component now, in two skins and three selection modes. The item is always
 * `Chip`, so the pill shape is declared exactly once in the app.
 *
 * `pill` is every free-flowing row -- filters, facets, links, static labels --
 * on one ground: transparent inside an outline, tinted with an accent outline
 * once selected. `segmented` is the joined switch for a view or a mode.
 */
const meta = {
  title: 'Primitives/ChipGroup',
  component: ChipGroup,
  tags: ['autodocs'],
} satisfies Meta<typeof ChipGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

/* ── select: single ───────────────────────────────────────── */

/**
 * The profile status tabs: pills with count badges, one on, and a muted zero on
 * the empty statuses. This row was the `underline` skin until the app settled on
 * two treatments; the selected wash says what the rule under a tab used to.
 */
export const SinglePillWithCounts: Story = {
  args: {
    items: STATUS_TABS,
    value: 'watching',
    onSelect: () => {},
    variant: 'pill',
    ariaLabel: 'Filter by status',
  },
};

/** More tabs than fit on a line: a pill row wraps rather than squashing or clipping. */
export const SinglePillOverflowing: Story = {
  args: {
    items: [
      ...STATUS_TABS,
      { value: 'rewatching', label: 'Rewatching', count: 3 },
      { value: 'favourites', label: 'Favourites', count: 28 },
      { value: 'recommended', label: 'Recommended', count: 9 },
    ],
    value: 'completed',
    onSelect: () => {},
    variant: 'pill',
    ariaLabel: 'Filter by status',
  },
};

/** ProfileList's anime/manga switch: a compact segmented control with the active side filled. */
export const SingleSegmented: Story = {
  args: {
    items: [
      { value: 'anime', label: 'Anime' },
      { value: 'manga', label: 'Manga' },
    ],
    value: 'anime',
    onSelect: () => {},
    variant: 'segmented',
    ariaLabel: 'Anime or manga',
  },
};

/** CurrentlyAiringPage's schedule/calendar switch, keeping its own inline SVGs via `itemContent`. */
export const SingleSegmentedWithCustomContent: Story = {
  args: {
    items: [
      { value: 'schedule', label: 'Schedule' },
      { value: 'calendar', label: 'Calendar', icon: faCalendarDays },
    ],
    value: 'schedule',
    onSelect: () => {},
    variant: 'segmented',
    ariaLabel: 'View mode',
    itemContent: svgItem,
  },
};

/** Grid/list mode: `toggle` mode, so these are pressed buttons rather than tabs, each named by its title. */
export const SingleIconOnlyToggle: Story = {
  args: {
    items: VIEW_TABS,
    value: 'grid',
    onSelect: () => {},
    variant: 'segmented',
    mode: 'toggle',
    iconOnly: true,
    ariaLabel: 'View mode',
  },
};

/** CharactersWithStaff's filter row: pills that wrap over as many lines as they need. */
export const SinglePill: Story = {
  args: {
    items: [
      { value: 'all', label: 'All' },
      { value: 'main', label: 'Main' },
      { value: 'supporting', label: 'Supporting' },
      { value: 'japanese', label: 'Japanese VA' },
      { value: 'english', label: 'English VA' },
    ],
    value: 'main',
    onSelect: () => {},
    variant: 'pill',
    ariaLabel: 'Filter characters',
  },
};

/**
 * The season strips on / and /season. `toggle` mode leaves plain buttons -- no
 * `role="tab"` overriding the implicit button role -- `activeMarker="current"`
 * marks the season being shown with aria-current="page" because these NAVIGATE
 * rather than reveal a panel, and `size="touch"` is the 44px target the homepage
 * copy of this strip used to carry alone.
 */
export const SingleSegmentedNavigationTouch: Story = {
  args: {
    items: [
      { value: 'WINTER_2026', label: 'Winter' },
      { value: 'SPRING_2026', label: 'Spring' },
      { value: 'SUMMER_2026', label: 'Summer' },
      { value: 'FALL_2026', label: 'Fall' },
    ],
    value: 'SPRING_2026',
    onSelect: () => {},
    variant: 'segmented',
    mode: 'toggle',
    activeMarker: 'current',
    size: 'touch',
    ariaLabel: 'Season',
  },
};

/**
 * The news category chips: pills with counts, each standing for its own colour.
 * `accent` draws the leading dot and tints the selected wash with it, so four
 * categories stay tellable apart while the resting row stays calm and neutral.
 */
export const SinglePillWithAccentsAndCounts: Story = {
  args: {
    items: [
      { value: 'all', label: 'All', count: 48 },
      { value: 'announcement', label: 'Announcement', count: 19, accent: 'var(--weeb-accent)' },
      { value: 'release', label: 'Release', count: 14, accent: 'var(--weeb-green)' },
      { value: 'staff', label: 'Staff', count: 9, accent: 'var(--weeb-violet)' },
      { value: 'reception', label: 'Reception', count: 6, accent: 'var(--weeb-amber)' },
    ],
    value: 'release',
    onSelect: () => {},
    variant: 'pill',
    mode: 'toggle',
    ariaLabel: 'Filter by category',
  },
};

/** A disabled item is skipped by both the pointer and the arrow keys. */
export const SingleWithDisabledItem: Story = {
  args: {
    items: [
      { value: 'anime', label: 'Anime' },
      { value: 'manga', label: 'Manga' },
      { value: 'novels', label: 'Novels', disabled: true },
    ],
    value: 'anime',
    onSelect: () => {},
    variant: 'segmented',
    ariaLabel: 'Medium',
  },
};

/* ── select: multi ────────────────────────────────────────── */

/** The resting facet row: nothing on, so neither the clear chip nor a selected wash. */
export const MultiDefault: Story = {
  args: {
    select: 'multi',
    items: GENRES,
    isSelected: () => false,
    onSelect: () => {},
    ariaLabel: 'Filter by genre',
  },
};

/** More than one on at once -- the thing `select="multi"` is for. */
export const MultipleSelected: Story = {
  args: {
    select: 'multi',
    items: GENRES,
    isSelected: someSelected('Action', 'Drama', 'Sci-Fi'),
    onSelect: () => {},
    ariaLabel: 'Filter by genre',
  },
};

/** /season's tag filter: a leading Clear chip and a reversible "+N more". */
export const MultiWithClearAndReversibleMore: Story = {
  args: {
    select: 'multi',
    items: TAGS,
    isSelected: someSelected('Mecha'),
    onSelect: () => {},
    clear: { onClear: () => {} },
    more: { hiddenCount: 24, expanded: false, onToggle: () => {}, collapseLabel: 'Show less' },
    ariaLabel: 'Filter by tag',
  },
};

/** The same row expanded: the more chip flips to its collapse label. */
export const MultiMoreExpanded: Story = {
  args: {
    select: 'multi',
    items: TAGS,
    isSelected: someSelected('Mecha'),
    onSelect: () => {},
    clear: { onClear: () => {} },
    more: { hiddenCount: 24, expanded: true, onToggle: () => {}, collapseLabel: 'Show less' },
    ariaLabel: 'Filter by tag',
  },
};

/**
 * /search's facets: a one-way reveal. With no `collapseLabel` the more chip
 * retires once `expanded`, rather than offering a way back. `itemClass` is the
 * `.genre-tag` hook browse-search.spec.ts selects on.
 */
export const MultiOneWayReveal: Story = {
  args: {
    select: 'multi',
    items: GENRES,
    isSelected: someSelected('Action'),
    onSelect: () => {},
    more: { hiddenCount: 31, expanded: false, onToggle: () => {} },
    ariaLabel: 'Filter by genre',
    itemClass: 'genre-tag',
  },
};

/** A facet with nothing behind it recedes, the way an empty status tab does. */
export const MultiWithZeroCount: Story = {
  args: {
    select: 'multi',
    items: TAGS,
    isSelected: () => false,
    onSelect: () => {},
    ariaLabel: 'Filter by tag',
  },
};

/** Enough facets to wrap over several rows, which is the /search default. */
export const MultiOverflowing: Story = {
  args: {
    select: 'multi',
    items: [
      ...GENRES,
      ...TAGS,
      { value: 'Psychological', label: 'Psychological', count: 233 },
      { value: 'Supernatural', label: 'Supernatural', count: 401 },
      { value: 'Music', label: 'Music', count: 118 },
      { value: 'Mystery', label: 'Mystery', count: 356 },
    ],
    isSelected: someSelected('Action', 'Mystery'),
    onSelect: () => {},
    clear: { onClear: () => {} },
    ariaLabel: 'Filter by genre',
  },
};

/* ── select: none ─────────────────────────────────────────── */

/**
 * The homepage's "Browse by Tag" row: links, at the touch height, selecting
 * nothing -- and on the same transparent ground as any other pill row, since a
 * link into the catalogue is not a different kind of thing from a filter.
 */
export const NoneGenreLinks: Story = {
  args: {
    select: 'none',
    items: BROWSE_GENRE_LINKS,
    size: 'touch',
    ariaLabel: 'Browse by tag',
  },
};

/** Static labels -- no href and no selection, so each chip is a span. Same ground again. */
export const NoneStaticLabels: Story = {
  args: {
    select: 'none',
    items: [{ label: 'TV' }, { label: '24 min' }, { label: 'Madhouse' }, { label: 'PG-13' }],
  },
};

/** The dense size, for a metadata row rather than a way into the catalogue. */
export const NoneSmall: Story = {
  args: {
    select: 'none',
    size: 'sm',
    items: [{ label: 'Action' }, { label: 'Adventure' }, { label: 'Fantasy' }],
  },
};

/** Overflowing: the row wraps rather than scrolling or clipping. */
export const NoneWrapping: Story = {
  args: {
    select: 'none',
    items: BROWSE_GENRE_LINKS.concat(
      BROWSE_GENRE_LINKS.map((g) => ({ ...g, label: `${g.label} II` }))
    ),
  },
};
