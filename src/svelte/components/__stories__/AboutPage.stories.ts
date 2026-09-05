import type { Meta, StoryObj } from '@storybook/svelte';
import AboutPage from '../AboutPage.svelte';

/**
 * The /about page. Static copy with no bloc, so there is one state to show --
 * the page itself, which is the point of having it here: it is the one surface
 * whose long-form typography and section rhythm are checked by reading it.
 */
const meta = {
  title: 'Pages/AboutPage',
  component: AboutPage,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AboutPage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The whole page: header, features, technical details and the prose sections. */
export const Default: Story = {};
