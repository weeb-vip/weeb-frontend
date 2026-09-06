import type { Meta, StoryObj } from '@storybook/svelte';
import AuthInitializerDemo from '$lib/components/__stories__/AuthInitializerDemo.svelte';
import type { AuthScenario } from '$lib/components/__stories__/provider-stubs';

/**
 * Bringing the client session up on mount. It renders nothing at all, so every
 * story here shows what it DOES instead: the session state a child ends up
 * observing, and the port calls that got it there, in order.
 *
 * Each story is one path through `AuthInitializerBloc`, driven entirely through
 * its injected ports -- so there is no GraphQL, no token refresher, no
 * `localStorage`, and nothing published onto the Storybook `window`.
 */
type AuthInitializerArgs = { scenario: AuthScenario };

const meta = {
  title: 'Composites/App Shell/AuthInitializer',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  render: (args: AuthInitializerArgs) => ({ Component: AuthInitializerDemo, props: args }),
} satisfies Meta<AuthInitializerArgs>;

export default meta;
type Story = StoryObj<AuthInitializerArgs>;

/** The common case: the server already read the cookies, so the session settles with no round trip for it. */
export const SignedInFromServer: Story = {
  args: { scenario: 'server-signed-in' },
};

/** The server says nobody is signed in: straight to logout, and no user fetch at all. */
export const SignedOutFromServer: Story = {
  args: { scenario: 'server-signed-out' },
};

/** The analytics fetch fails. They are logged in either way, so the session is kept and only the identification is lost. */
export const AnalyticsFetchFails: Story = {
  args: { scenario: 'server-analytics-fails' },
};

/** Nothing from the server, so the user query decides -- it answers, and the refresher starts from the stored token. */
export const ResolvedByUserQuery: Story = {
  args: { scenario: 'query-signed-in' },
};

/** The same path with the query failing: signed out, stale tokens cleared, and auth still marked initialised. */
export const UserQueryFails: Story = {
  args: { scenario: 'query-fails' },
};
