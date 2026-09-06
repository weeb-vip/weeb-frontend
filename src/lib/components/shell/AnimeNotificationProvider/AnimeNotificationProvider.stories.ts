import type { Meta, StoryObj } from '@storybook/svelte';
import AnimeNotificationProviderDemo from '$lib/components/__stories__/AnimeNotificationProviderDemo.svelte';

/**
 * Starts episode notifications once per browser session, and renders nothing.
 *
 * So the stories show the store the manager fills, read by a probe, together
 * with the number of times it was asked to start -- one, however many times the
 * component remounts, which is the guard's whole job and is remountable here
 * with a button.
 *
 * Both ports are stubbed: the real manager opens a web worker, queries the
 * GraphQL gateway for what is airing and writes sent-notification records to
 * `localStorage`, and the real guard is a flag on `window` that would follow
 * the reader into every other story.
 */
type AnimeNotificationProviderArgs = { alreadyClaimed?: boolean };

const meta = {
  title: 'Composites/App Shell/AnimeNotificationProvider',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  render: (args: AnimeNotificationProviderArgs) => ({
    Component: AnimeNotificationProviderDemo,
    props: args,
  }),
} satisfies Meta<AnimeNotificationProviderArgs>;

export default meta;
type Story = StoryObj<AnimeNotificationProviderArgs>;

/** First mount of the session: the manager starts once and the store fills with what is airing. */
export const StartsOnce: Story = {
  args: { alreadyClaimed: false },
};

/**
 * The session has already claimed the work -- what every remount after the
 * first one looks like, and what a client-side navigation lands in. The
 * provider starts nothing and the store stays untouched.
 */
export const AlreadyStarted: Story = {
  args: { alreadyClaimed: true },
};
