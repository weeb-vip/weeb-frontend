import type { Meta, StoryObj } from '@storybook/svelte';
import PosterGridFitDemo from './PosterGridFitDemo.svelte';

/**
 * Does the placeholder actually stand in for the card that replaces it?
 *
 * The contrast story that used to sit beside this one drew `AnimeCardSkeleton`
 * into the same grid to show what the wrong placeholder looked like. That
 * component had no callers outside these stories and has been deleted, so the
 * comparison went with it -- what is left is the check that still means
 * something.
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

/** Loaded cards and placeholders in one grid, at the same cell width. */
export const PosterCardSkeletonFits: Story = {};
