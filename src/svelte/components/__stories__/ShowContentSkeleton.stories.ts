import type { Meta, StoryObj } from '@storybook/svelte';
import ShowContentSkeleton from '../ShowContentSkeleton.svelte';

const meta = {
  title: 'Composites/Show/ShowContentSkeleton',
  component: ShowContentSkeleton,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof ShowContentSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The whole anime detail page in placeholder form: hero, details panel, tabs. */
export const Default: Story = {};
