import type { Meta, StoryObj } from '@storybook/svelte';
import Footer from '../Footer.svelte';

const meta = {
  title: 'Design System/Footer',
  component: Footer,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<Footer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
