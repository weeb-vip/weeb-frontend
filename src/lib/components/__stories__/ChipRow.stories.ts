import type { Meta, StoryObj } from '@storybook/svelte';
import ChipRow from '$lib/components/primitives/ChipRow.svelte';
import { BROWSE_GENRE_LINKS } from '$lib/data/genres';

/**
 * A wrapping row of `Chip`s -- what is left of `GenrePills` once the sixteen
 * genre names hardcoded inside it moved out to `$lib/data/genres`.
 */
const meta = {
  title: 'Primitives/ChipRow',
  component: ChipRow,
  tags: ['autodocs'],
} satisfies Meta<typeof ChipRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The homepage's "Browse by Tag" row: links, at the touch height. */
export const GenreLinks: Story = {
  args: { items: BROWSE_GENRE_LINKS, touch: true, ariaLabel: 'Browse by tag' },
};

/** Static labels -- no href, so each chip is a span. */
export const StaticLabels: Story = {
  args: { items: [{ label: 'TV' }, { label: '24 min' }, { label: 'Madhouse' }, { label: 'PG-13' }] },
};

/** The dense size, for a metadata row rather than a way into the catalogue. */
export const Small: Story = {
  args: {
    size: 'sm',
    items: [{ label: 'Action' }, { label: 'Adventure' }, { label: 'Fantasy' }],
  },
};

/** Overflowing: the row wraps rather than scrolling or clipping. */
export const Wrapping: Story = {
  args: {
    items: BROWSE_GENRE_LINKS.concat(BROWSE_GENRE_LINKS.map((g) => ({ ...g, label: `${g.label} II` }))),
  },
};
