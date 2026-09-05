import type { Meta, StoryObj } from '@storybook/svelte';
import AiringIndicator from '$lib/components/primitives/AiringIndicator.svelte';

/**
 * "This is on the air", drawn one way.
 *
 * There were four treatments in two colours: a green dot with a glow on
 * `PosterCard`, a green chip with a pulsing dot in `ShowQuickInfo`, a green dot
 * beside "Now" in `HeroAiringRail`, and AMBER text with a broadcast-tower icon
 * on `AnimeCard` -- in a palette where amber already meant "upcoming".
 *
 * Green is airing, amber is upcoming, and the pulse only ever runs on the green
 * one (and never under `prefers-reduced-motion`).
 */
const meta = {
  title: 'Primitives/AiringIndicator',
  component: AiringIndicator,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    state: { control: 'select', options: ['airing', 'upcoming'] },
    presentation: { control: 'select', options: ['dot', 'chip'] },
  },
} satisfies Meta<typeof AiringIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The bare marker, for a card corner or the end of a rail row. Green, pulsing. */
export const AiringDot: Story = {
  args: { state: 'airing' },
};

/** Amber, and still: something merely scheduled must not move. */
export const UpcomingDot: Story = {
  args: { state: 'upcoming' },
};

/** The chip presentation, which is `Chip` with the dot inside it. */
export const AiringChip: Story = {
  args: { state: 'airing', presentation: 'chip', label: 'Airing' },
};

/** A countdown label takes the mono face. */
export const AiringChipMono: Story = {
  args: { state: 'airing', presentation: 'chip', label: 'NOW', mono: true },
};

/** Upcoming as a chip. */
export const UpcomingChip: Story = {
  args: { state: 'upcoming', presentation: 'chip', label: 'Upcoming' },
};

/** The pulse turned off where the motion would be noise. */
export const NoPulse: Story = {
  args: { state: 'airing', pulse: false },
};
