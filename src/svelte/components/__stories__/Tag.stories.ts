import type { Meta, StoryObj } from '@storybook/svelte';
import Tag from '../Tag.svelte';

const meta = {
  title: 'Primitives/Tag',
  component: Tag,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof Tag>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The ordinary case: one short genre label. */
export const Default: Story = {
  args: {
    tag: 'Action',
  },
};

/** A long label -- the pill never wraps, so it grows instead of breaking. */
export const LongLabel: Story = {
  args: {
    tag: 'Slice of Life, Supernatural & Psychological Drama',
  },
};

/** `className` is appended, so a caller can restyle the pill in place. */
export const CustomClass: Story = {
  args: {
    tag: 'Airing',
    className: 'text-weeb-accent-text',
  },
};
