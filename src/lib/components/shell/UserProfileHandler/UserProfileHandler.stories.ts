import type { Meta, StoryObj } from '@storybook/svelte';
import UserProfileHandlerDemo from '$lib/components/__stories__/UserProfileHandlerDemo.svelte';

/**
 * The header's account slot: `ConfigProvider`, `QueryProvider`, and
 * `UserProfileWrapper` inside them. It owns no state and draws no markup of its
 * own, so what the stories show is the composition -- the wrapper's bloc calls
 * `createQuery`, which reads a QueryClient out of context during
 * initialisation, so the slot rendering at all means both providers are there.
 *
 * It takes no bloc, so nothing can be injected into it. The stories stub what
 * the real bloc reads instead: the auth store is set directly, the user query
 * is answered from a freshly seeded cache entry, and both singletons are handed
 * back on teardown. Nothing reaches the network.
 */
type UserProfileHandlerArgs = { signedIn?: boolean; isMobile?: boolean };

const meta = {
  title: 'Composites/App Shell/UserProfileHandler',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  render: (args: UserProfileHandlerArgs) => ({ Component: UserProfileHandlerDemo, props: args }),
} satisfies Meta<UserProfileHandlerArgs>;

export default meta;
type Story = StoryObj<UserProfileHandlerArgs>;

/** Signed out on the desktop header: the Login and Register pair, with the query disabled. */
export const SignedOut: Story = {
  args: { signedIn: false },
};

/** Signed in: the profile dropdown, drawn from the user the cached query answered with. */
export const SignedIn: Story = {
  args: { signedIn: true },
};

/** The narrow header gets the avatar that opens the drawer instead of the two CTAs. */
export const SignedInMobile: Story = {
  args: { signedIn: true, isMobile: true },
};
