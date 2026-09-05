import type { Meta, StoryObj } from '@storybook/svelte';
import PosterGridDemo from './PosterGridDemo.svelte';

/**
 * The grid renders whatever cards it is given, so every story goes through
 * PosterGridDemo -- a thin wrapper that supplies stand-in tiles.
 */
type PosterGridArgs = {
  minHeight?: string | null;
  loading?: boolean;
  class?: string;
  count?: number;
};

const meta = {
  title: 'Primitives/PosterGrid',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  render: (args: PosterGridArgs) => ({ Component: PosterGridDemo, props: args }),
} satisfies Meta<PosterGridArgs>;

export default meta;
type Story = StoryObj<PosterGridArgs>;

/** A full shelf: auto-fill decides the column count from the viewport width. */
export const Default: Story = {
  args: {
    count: 12,
  },
};

/** A short shelf still fills the row rather than stretching seven cards across it. */
export const FewItems: Story = {
  args: {
    count: 3,
  },
};

/** Refetching: the grid dims and stops taking clicks, but keeps its geometry. */
export const Loading: Story = {
  args: {
    count: 8,
    loading: true,
  },
};

/** Nothing to show. `minHeight` holds the space so the page below does not jump. */
export const Empty: Story = {
  args: {
    count: 0,
    minHeight: '400px',
  },
};
