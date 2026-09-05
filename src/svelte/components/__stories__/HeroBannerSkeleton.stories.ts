import type { Meta, StoryObj } from '@storybook/svelte';
import HeroBannerSkeleton from '../HeroBannerSkeleton.svelte';

const meta = {
  title: 'Design System/HeroBannerSkeleton',
  component: HeroBannerSkeleton,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof HeroBannerSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The hero's placeholder: shimmering background, badge, title, meta and buttons. */
export const Default: Story = {};
