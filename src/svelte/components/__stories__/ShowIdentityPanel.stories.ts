import type { Meta, StoryObj } from '@storybook/svelte';
import ShowIdentityPanel from '../ShowIdentityPanel.svelte';
import { FULL_ANIME, MINIMAL_ANIME, TRACKED_ANIME, UNAIRED_ANIME } from './show-fixtures';

const meta = {
  title: 'Show/ShowIdentityPanel',
  component: ShowIdentityPanel,
  tags: ['autodocs'],
} satisfies Meta<typeof ShowIdentityPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every band filled: cover, both titles, season link, qualifiers, source, genres, watch-on. */
export const Populated: Story = {
  args: {
    anime: FULL_ANIME,
    title: FULL_ANIME.titleEn,
    seasonText: 'Season 1',
    seriesLink: '/series/frieren',
    studio: 'Madhouse',
  },
};

/** On the list: the one action becomes the status control. */
export const OnMyList: Story = {
  args: { ...Populated.args, anime: TRACKED_ANIME },
};

/** Signed out — the same panel, offering to add rather than to move. */
export const NotOnMyList: Story = {
  args: { ...Populated.args, anime: FULL_ANIME },
};

/** A season we know but a series page we do not have: the label is plain text. */
export const SeasonWithoutSeriesPage: Story = {
  args: { ...Populated.args, seriesLink: '' },
};

/** No season, no Japanese title, no source work, no genres: most of the catalogue. */
export const MinimalRecord: Story = {
  args: { anime: MINIMAL_ANIME, title: MINIMAL_ANIME.titleEn, studio: null },
};

/** A long title, which is what pushed the poster out of the panel before. */
export const LongTitle: Story = {
  args: {
    ...Populated.args,
    title: 'The Exiled Heavy Knight Knows How to Game the System, and Does So Relentlessly',
  },
};

/** An unaired second season, reachable from the first through the season link. */
export const Unaired: Story = {
  args: {
    anime: UNAIRED_ANIME,
    title: UNAIRED_ANIME.titleEn,
    seasonText: 'Season 2',
    seriesLink: '/series/frieren',
    studio: 'Madhouse',
  },
};
