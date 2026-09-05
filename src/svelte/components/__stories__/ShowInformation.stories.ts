import type { Meta, StoryObj } from '@storybook/svelte';
import ShowInformation from '../ShowInformation.svelte';
import { FULL_ANIME, MINIMAL_ANIME, UNAIRED_ANIME } from './show-fixtures';

const meta = {
  title: 'Composites/Show/ShowInformation',
  component: ShowInformation,
  tags: ['autodocs'],
} satisfies Meta<typeof ShowInformation>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every row present, including the source linked through to the manga it adapts. */
export const Populated: Story = {
  args: { anime: FULL_ANIME },
};

/** A source category we know without the work behind it: plain text, not a link. */
export const SourceWithoutWork: Story = {
  args: { anime: { ...FULL_ANIME, sourceWork: null } },
};

/** Two rows and nothing else -- a partial final row is just the container's ground. */
export const MinimalRecord: Story = {
  args: { anime: MINIMAL_ANIME },
};

/** Still airing, so the end of the run reads "Ongoing" rather than a date. */
export const Ongoing: Story = {
  args: { anime: UNAIRED_ANIME },
};
