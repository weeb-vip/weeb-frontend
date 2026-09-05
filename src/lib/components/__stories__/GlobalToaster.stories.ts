import type { Meta, StoryObj } from '@storybook/svelte';
import GlobalToasterDemo from './GlobalToasterDemo.svelte';

/**
 * The app's one toast surface. It has no props worth driving and no output
 * until something raises a toast, so the stories go through a demo wrapper that
 * pins the viewport and raises one toast of each kind.
 */
type GlobalToasterArgs = { mobile?: boolean };

const meta = {
  title: 'Composites/App Shell/GlobalToaster',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  render: (args: GlobalToasterArgs) => ({ Component: GlobalToasterDemo, props: args }),
} satisfies Meta<GlobalToasterArgs>;

export default meta;
type Story = StoryObj<GlobalToasterArgs>;

/** Desktop: the stack sits in the top-right corner, under where the nav would be. */
export const Desktop: Story = {
  args: { mobile: false },
};

/**
 * Narrow viewports get the top-centre stack instead -- a 22rem card pinned to
 * the right either overflows a phone or crowds its edge.
 */
export const Mobile: Story = {
  args: { mobile: true },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
