import type { Meta, StoryObj } from '@storybook/svelte';
import Skeleton from '$lib/components/primitives/Skeleton.svelte';

const meta = {
  title: 'Primitives/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The base block: a pulsing surface sized entirely by `className`. */
export const Default: Story = {
  args: {
    className: 'w-64 h-8',
  },
};

/** Poster-shaped, for a card that has not loaded yet. */
export const Card: Story = {
  args: {
    className: 'w-48 h-72 rounded-lg',
  },
};

/** A single line of copy, full width of its container. */
export const TextLine: Story = {
  args: {
    className: 'w-full h-4 rounded',
  },
};

/** A circular avatar placeholder. */
export const Avatar: Story = {
  args: {
    className: 'w-12 h-12 rounded-full',
  },
};

/**
 * A design-system radius rather than a Tailwind `rounded-*` class. Left off,
 * the box keeps Tailwind's `rounded` so the callers that pass their own radius
 * in `className` still win -- an inline radius would override those.
 */
export const TokenRadius: Story = {
  args: {
    className: 'w-48 h-24',
    radius: 'lg',
  },
};
