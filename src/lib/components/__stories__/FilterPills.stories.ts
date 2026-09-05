import type { Meta, StoryObj } from '@storybook/svelte';
import FilterPills, { type FilterPillItem } from '$lib/components/primitives/FilterPills.svelte';

const GENRES: FilterPillItem[] = [
  { value: 'Action', label: 'Action', count: 4821 },
  { value: 'Adventure', label: 'Adventure', count: 3140 },
  { value: 'Comedy', label: 'Comedy', count: 2977 },
  { value: 'Drama', label: 'Drama', count: 1866 },
  { value: 'Fantasy', label: 'Fantasy', count: 1502 },
  { value: 'Romance', label: 'Romance', count: 988 },
  { value: 'Sci-Fi', label: 'Sci-Fi', count: 741 },
  { value: 'Slice of Life', label: 'Slice of Life', count: 612 },
];

const TAGS: FilterPillItem[] = [
  { value: 'Shounen', label: 'Shounen', count: 42 },
  { value: 'Mecha', label: 'Mecha', count: 18 },
  { value: 'Isekai', label: 'Isekai', count: 15 },
  { value: 'Sports', label: 'Sports', count: 9 },
  { value: 'Historical', label: 'Historical', count: 4 },
  { value: 'Josei', label: 'Josei', count: 0 },
];

/** Selection is the caller's state, so each story hands in a fixed answer. */
const noneSelected = () => false;
const oneSelected = (wanted: string) => (value: string) => value === wanted;
const someSelected =
  (...wanted: string[]) =>
  (value: string) =>
    wanted.includes(value);

const meta = {
  title: 'Primitives/FilterPills',
  component: FilterPills,
  tags: ['autodocs'],
} satisfies Meta<typeof FilterPills>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The resting row: nothing on, so neither the clear pill nor a selected wash. */
export const Default: Story = {
  args: {
    items: GENRES,
    isSelected: noneSelected,
    onToggle: () => {},
    ariaLabel: 'Filter by genre',
  },
};

/**
 * More than one on at once -- the thing that makes this component, and not
 * `Tabs`, the right answer for a filter row.
 */
export const MultipleSelected: Story = {
  args: {
    items: GENRES,
    isSelected: someSelected('Action', 'Drama', 'Sci-Fi'),
    onToggle: () => {},
    ariaLabel: 'Filter by genre',
  },
};

/** /season's tag filter: a leading Clear pill and a reversible "+N more". */
export const WithClearAndReversibleMore: Story = {
  args: {
    items: TAGS,
    isSelected: oneSelected('Mecha'),
    onToggle: () => {},
    clear: { onClear: () => {} },
    more: { hiddenCount: 24, expanded: false, onToggle: () => {}, collapseLabel: 'Show less' },
    ariaLabel: 'Filter by tag',
  },
};

/** The same row expanded: the more pill flips to its collapse label. */
export const MoreExpanded: Story = {
  args: {
    items: TAGS,
    isSelected: oneSelected('Mecha'),
    onToggle: () => {},
    clear: { onClear: () => {} },
    more: { hiddenCount: 24, expanded: true, onToggle: () => {}, collapseLabel: 'Show less' },
    ariaLabel: 'Filter by tag',
  },
};

/**
 * /search's facets: a one-way reveal. With no `collapseLabel` the more pill
 * retires once `expanded`, rather than offering a way back.
 */
export const OneWayReveal: Story = {
  args: {
    items: GENRES,
    isSelected: oneSelected('Action'),
    onToggle: () => {},
    more: { hiddenCount: 31, expanded: false, onToggle: () => {} },
    ariaLabel: 'Filter by genre',
    pillClass: 'genre-tag',
  },
};

/** A facet with nothing behind it recedes, the way an empty status tab does. */
export const WithZeroCount: Story = {
  args: {
    items: TAGS,
    isSelected: noneSelected,
    onToggle: () => {},
    ariaLabel: 'Filter by tag',
  },
};

/** No counts at all -- the row still reads as a set of toggles. */
export const WithoutCounts: Story = {
  args: {
    items: GENRES.map(({ value, label }) => ({ value, label })),
    isSelected: someSelected('Comedy'),
    onToggle: () => {},
    ariaLabel: 'Filter by genre',
  },
};

/** Enough facets to wrap over several rows, which is the /search default. */
export const Overflowing: Story = {
  args: {
    items: [
      ...GENRES,
      ...TAGS,
      { value: 'Psychological', label: 'Psychological', count: 233 },
      { value: 'Supernatural', label: 'Supernatural', count: 401 },
      { value: 'Music', label: 'Music', count: 118 },
      { value: 'Mystery', label: 'Mystery', count: 356 },
    ],
    isSelected: someSelected('Action', 'Mystery'),
    onToggle: () => {},
    clear: { onClear: () => {} },
    ariaLabel: 'Filter by genre',
  },
};
