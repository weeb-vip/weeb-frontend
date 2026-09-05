import type { Meta, StoryObj } from '@storybook/svelte';
import ShowStickyHeader from '../ShowStickyHeader.svelte';
import { FULL_ANIME, MINIMAL_ANIME, TRACKED_ANIME, UNAIRED_ANIME } from './show-fixtures';

const meta = {
  title: 'Show/ShowStickyHeader',
  component: ShowStickyHeader,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ShowStickyHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Note: the bar portals itself to `<body>` and is `position: fixed`, so it
 * appears pinned under the toolbar rather than inside the story canvas.
 */
export const Visible: Story = {
  args: {
    anime: FULL_ANIME,
    title: FULL_ANIME.titleEn,
    background: 'https://cdn.weeb.vip/banners/frieren',
    visible: true,
    studio: 'Madhouse',
    airingLabel: 'Finished',
  },
};

/** On the list: the compact action is the status control. */
export const OnMyList: Story = {
  args: { ...Visible.args, anime: TRACKED_ANIME },
};

/** At rest, above the fold: translated out and inert. */
export const Hidden: Story = {
  args: { ...Visible.args, visible: false },
};

/** No CDN artwork behind it, so the bar falls back to its own ground. */
export const NoArtwork: Story = {
  args: { ...Visible.args, background: '' },
};

/** A record with no studio: the qualifier line loses its trailing item cleanly. */
export const MinimalRecord: Story = {
  args: {
    anime: MINIMAL_ANIME,
    title: MINIMAL_ANIME.titleEn,
    background: '',
    visible: true,
    studio: null,
    airingLabel: 'Finished',
  },
};

/** An unaired season, which reads as airing because it has no end date yet. */
export const Unaired: Story = {
  args: { ...Visible.args, anime: UNAIRED_ANIME, title: UNAIRED_ANIME.titleEn, airingLabel: 'Airing' },
};
