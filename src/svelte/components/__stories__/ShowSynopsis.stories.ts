import type { Meta, StoryObj } from '@storybook/svelte';
import ShowSynopsis from '../ShowSynopsis.svelte';
import { FULL_ANIME } from './show-fixtures';

const meta = {
  title: 'Show/ShowSynopsis',
  component: ShowSynopsis,
  tags: ['autodocs'],
} satisfies Meta<typeof ShowSynopsis>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A synopsis at its measure cap -- prose keeps 80ch however wide the page is. */
export const Populated: Story = {
  args: { description: FULL_ANIME.description },
};

/** A one-line entry, which plenty of the catalogue has. */
export const Short: Story = {
  args: { description: 'A short description, and nothing else recorded against it.' },
};

/** No synopsis: a gap in the catalogue, said plainly rather than left blank. */
export const Missing: Story = {
  args: { description: '' },
};
