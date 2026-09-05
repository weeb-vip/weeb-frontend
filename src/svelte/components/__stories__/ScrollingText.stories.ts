import type { Meta, StoryObj } from '@storybook/svelte';
import ScrollingText from '../ScrollingText.svelte';
import StoryContainer from './StoryContainer.svelte';

const meta = {
  title: 'Design System/ScrollingText',
  component: ScrollingText,
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
} satisfies Meta<typeof ScrollingText>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Fits the container, so nothing scrolls and no marquee is rendered at all. */
export const Fits: Story = {
  args: {
    text: 'Bocchi the Rock!',
    maxWidth: '240px',
  },
};

/** Too long to fit: truncated with an ellipsis, and it marquees on hover. */
export const Overflowing: Story = {
  args: {
    text: 'That Time I Got Reincarnated as a Slime the Movie: Scarlet Bond',
    maxWidth: '240px',
  },
};

/** Same overflowing title at a tenth of the speed, so the marquee is readable. */
export const SlowScroll: Story = {
  args: {
    text: 'That Time I Got Reincarnated as a Slime the Movie: Scarlet Bond',
    maxWidth: '240px',
    scrollSpeed: 5,
  },
};
