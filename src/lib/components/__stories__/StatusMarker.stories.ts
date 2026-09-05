import type { Meta, StoryObj } from '@storybook/svelte';
import StatusMarker from '$lib/components/primitives/StatusMarker.svelte';

/**
 * "This is on your list", as a corner ribbon.
 *
 * The same fact used to be drawn two opposite ways: this wordless ribbon in the
 * top-right of `PosterCard`, and an accent-filled pill reading "Watching" in
 * the top-LEFT of `AnimeCard`. The ribbon won -- twelve call sites, no word
 * over the artwork, and it never collides with the score badge opposite it.
 *
 * The glyph is the status; the colour is `STATUS_COLORS`.
 */
const meta = {
  title: 'Primitives/StatusMarker',
  component: StatusMarker,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    status: {
      control: 'select',
      options: ['WATCHING', 'COMPLETED', 'ONHOLD', 'DROPPED', 'PLANTOWATCH', null],
    },
  },
} satisfies Meta<typeof StatusMarker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Green, a play triangle. */
export const Watching: Story = { args: { status: 'WATCHING' } };

/** Accent, a tick. */
export const Completed: Story = { args: { status: 'COMPLETED' } };

/** Amber, a bookmark. Legacy snake_case normalises the same way. */
export const PlanToWatch: Story = { args: { status: 'plan_to_watch' } };

/** Muted, a pause. */
export const OnHold: Story = { args: { status: 'ONHOLD' } };

/** Red, a cross. */
export const Dropped: Story = { args: { status: 'DROPPED' } };

/** Nothing recognised, so nothing renders -- not a blank ribbon. */
export const Unknown: Story = { args: { status: 'not-a-status' } };
