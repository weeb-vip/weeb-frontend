import type { Meta, StoryObj } from '@storybook/svelte';
import PosterGridFitDemo from './PosterGridFitDemo.svelte';

/**
 * Does the placeholder actually stand in for the card that replaces it?
 *
 * ProfileMediaList's loading state rendered `AnimeCardSkeleton` into a
 * `PosterGrid` of `PosterCard`s, which is two different cards. These two
 * stories put loaded cards and placeholders in one grid so the difference is
 * something to look at rather than take on trust.
 */
const meta = {
  title: 'Composites/Cards/SkeletonFit',
  component: PosterGridFitDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof PosterGridFitDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * `PosterCardSkeleton`, which is what the list renders now: the poster box, the
 * title line and the sub-line land where the loaded card puts them, and the
 * cell width is the grid's rather than the skeleton's.
 */
export const PosterCardSkeletonFits: Story = {
  args: { skeleton: 'poster' },
};

/**
 * `AnimeCardSkeleton`, which is what it rendered before: a fixed 192x288 box
 * with the metadata column beside the art. It neither fills the cell nor lines
 * up with anything that loads in.
 */
export const AnimeCardSkeletonDoesNot: Story = {
  args: { skeleton: 'anime' },
};
