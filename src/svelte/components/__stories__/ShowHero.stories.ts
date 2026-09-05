import type { Meta, StoryObj } from '@storybook/svelte';
import ShowHero from '../ShowHero.svelte';
import { FULL_ANIME, MINIMAL_ANIME, TRACKED_ANIME, UNAIRED_ANIME } from './show-fixtures';

const meta = {
  title: 'Show/ShowHero',
  component: ShowHero,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ShowHero>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Artwork present and painted: the panel sits on the show's own key art. */
export const Populated: Story = {
  args: {
    anime: FULL_ANIME,
    title: FULL_ANIME.titleEn,
    seasonText: 'Season 1',
    seriesLink: '/series/frieren',
    studio: 'Madhouse',
    imageSources: ['https://cdn.weeb.vip/banners/frieren'],
    loaded: true,
    onArtChosen: () => {},
  },
};

/** Already on the list, so the hero action is the status control rather than "Add". */
export const OnMyList: Story = {
  args: { ...Populated.args, anime: TRACKED_ANIME },
};

/** Nothing has painted yet: the artwork layer is still transparent. */
export const ArtLoading: Story = {
  args: { ...Populated.args, loaded: false },
};

/** No artwork on the CDN at all — the panel over the elevated ground. */
export const NoArtwork: Story = {
  args: { ...Populated.args, imageSources: [] },
};

/** A record with no season, no source work, no genres and no streaming rows. */
export const MinimalRecord: Story = {
  args: {
    anime: MINIMAL_ANIME,
    title: MINIMAL_ANIME.titleEn,
    studio: null,
    imageSources: [],
    loaded: true,
    onArtChosen: () => {},
  },
};

/** A second season that has not aired: the series link is the way back to the first. */
export const Unaired: Story = {
  args: {
    anime: UNAIRED_ANIME,
    title: UNAIRED_ANIME.titleEn,
    seasonText: 'Season 2',
    seriesLink: '/series/frieren',
    studio: 'Madhouse',
    imageSources: ['https://cdn.weeb.vip/banners/frieren'],
    loaded: true,
    onArtChosen: () => {},
  },
};
