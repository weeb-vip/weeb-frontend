import type { Meta, StoryObj } from '@storybook/svelte';
import ShowQuickInfo from '../ShowQuickInfo.svelte';
import { FULL_ANIME, MINIMAL_ANIME, TRACKED_ANIME, UNAIRED_ANIME } from './show-fixtures';

const meta = {
  title: 'Show/ShowQuickInfo',
  component: ShowQuickInfo,
  tags: ['autodocs'],
} satisfies Meta<typeof ShowQuickInfo>;

export default meta;
type Story = StoryObj<typeof meta>;

const handlers = { onScore: (value: string) => console.log('score', value), onStep: (delta: number) => console.log('step', delta) };

/** Signed out, or simply not tracking it: the controls are present but inert. */
export const NotOnMyList: Story = {
  args: {
    anime: FULL_ANIME,
    airingLabel: 'Finished',
    airing: false,
    studio: 'Madhouse',
    episodeCount: 28,
    nextChip: null,
    canTrack: false,
    watched: 0,
    total: 28,
    ...handlers,
  },
};

/** On the list and part way through: score set, stepper live. */
export const OnMyList: Story = {
  args: {
    ...NotOnMyList.args,
    anime: TRACKED_ANIME,
    canTrack: true,
    score: 9,
    watched: 11,
  },
};

/** Finished the show: the plus step has nowhere left to go. */
export const Completed: Story = {
  args: { ...OnMyList.args, watched: 28 },
};

/** A write in flight — every control is held until the server answers. */
export const Saving: Story = {
  args: { ...OnMyList.args, pending: true },
};

/** Currently broadcasting, with the pulsing NOW chip. */
export const AiringNow: Story = {
  args: { ...OnMyList.args, airingLabel: 'Airing', airing: true, nextChip: 'NOW' },
};

/** Announced, not yet aired: a countdown chip and an unknown total. */
export const Unaired: Story = {
  args: {
    anime: UNAIRED_ANIME,
    airingLabel: 'Airing',
    airing: true,
    studio: 'Madhouse',
    episodeCount: 1,
    nextChip: 'Next in 3h',
    canTrack: false,
    watched: 0,
    total: null,
    ...handlers,
  },
};

/** No ranking, no studio, no rating, no episodes: two chips and the controls. */
export const MinimalRecord: Story = {
  args: {
    anime: MINIMAL_ANIME,
    airingLabel: 'Finished',
    airing: false,
    studio: null,
    episodeCount: 0,
    nextChip: null,
    canTrack: false,
    watched: 0,
    total: null,
    ...handlers,
  },
};
