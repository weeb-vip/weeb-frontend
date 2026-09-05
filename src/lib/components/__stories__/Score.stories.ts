import type { Meta, StoryObj } from '@storybook/svelte';
import Score from '$lib/components/primitives/Score.svelte';

/**
 * A rating, drawn one way.
 *
 * It was drawn five ways across three components -- two of them inside
 * `PosterCard` alone -- with four different star glyphs between them. One
 * filled SVG star now, and mono tabular numerals in both variants.
 */
const meta = {
  title: 'Primitives/Score',
  component: Score,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    variant: { control: 'select', options: ['badge', 'inline'] },
  },
} satisfies Meta<typeof Score>;

export default meta;
type Story = StoryObj<typeof meta>;

/** In a text row: a search result, a profile list row. */
export const Inline: Story = {
  args: { value: 8.7 },
};

/** Over cover art, on the scrim that keeps it legible against near-white keyart. */
export const Badge: Story = {
  args: { value: 9.1, variant: 'badge' },
};

/** Absent, not zero: no star, no colour, no weight. */
export const NoScore: Story = {
  args: { value: null },
};

/** A pre-formatted string passes through untouched. */
export const StringValue: Story = {
  args: { value: '10' },
};
