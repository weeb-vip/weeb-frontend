import type { Meta, StoryObj } from '@storybook/svelte';
import ShowSection from '../ShowSection.svelte';
import ShowSynopsis from '../ShowSynopsis.svelte';
import { createRawSnippet } from 'svelte';
import { FULL_ANIME } from './show-fixtures';

const meta = {
  title: 'Show/ShowSection',
  component: ShowSection,
  tags: ['autodocs'],
} satisfies Meta<typeof ShowSection>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The heading, its trailing rule, and whatever the section holds. */
export const Default: Story = {
  args: {
    id: 'show-section-synopsis',
    heading: 'Synopsis',
    children: createRawSnippet(() => ({
      render: () => `<p style="color: var(--weeb-fg-secondary); font-size: 15px; line-height: 1.8;">${FULL_ANIME.description}</p>`,
    })),
  },
};

/** A long heading still leaves a rule -- it shrinks rather than wrapping. */
export const LongHeading: Story = {
  args: {
    ...Default.args,
    id: 'show-section-characters',
    heading: 'Characters & Staff, with every credited voice actor',
  },
};
