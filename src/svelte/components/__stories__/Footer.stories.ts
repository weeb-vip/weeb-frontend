import type { Meta, StoryObj } from '@storybook/svelte';
import Footer from '../Footer.svelte';

const meta = {
  title: 'Design System/Footer',
  component: Footer,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof Footer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The site footer, with the build version pulled from `__APP_VERSION__`. */
export const Default: Story = {};
