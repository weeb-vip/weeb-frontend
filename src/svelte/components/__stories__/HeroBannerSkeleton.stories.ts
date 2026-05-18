import type { Meta, StoryObj } from '@storybook/svelte';
import HeroBannerSkeleton from '../HeroBannerSkeleton.svelte';

const meta = {
  title: 'Design System/HeroBannerSkeleton',
  component: HeroBannerSkeleton,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<HeroBannerSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
