import type { Meta, StoryObj } from '@storybook/svelte';
import ScrollingTags from '../ScrollingTags.svelte';
import StoryContainer from './StoryContainer.svelte';

const meta = {
  title: 'Design System/ScrollingTags',
  component: ScrollingTags,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  decorators: [
    () => ({
      Component: StoryContainer,
      props: { width: '240px' },
    }),
  ],
} satisfies Meta<typeof ScrollingTags>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Two tags fit the row, so there is no fade and nothing to scroll. */
export const Fits: Story = {
  args: {
    tags: ['Action', 'Comedy'],
  },
};

/** More tags than fit: a gradient fades the cut edge, and hovering marquees them. */
export const Overflowing: Story = {
  args: {
    tags: ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Mecha', 'Supernatural'],
  },
};

/** No tags at all -- the muted "No tags" chip keeps the row from collapsing. */
export const Empty: Story = {
  args: {
    tags: [],
  },
};
