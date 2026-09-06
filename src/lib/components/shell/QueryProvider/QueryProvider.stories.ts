import type { Meta, StoryObj } from '@storybook/svelte';
import QueryProviderDemo from '$lib/components/__stories__/QueryProviderDemo.svelte';

/**
 * The one place a TanStack QueryClient is put into Svelte context.
 *
 * It renders no markup, so the story is the child: `QueryClientContextProbe`
 * calls `useQueryClient()` during its own initialisation -- which throws when
 * there is none, so the panel appearing at all is the assertion -- and reports
 * the client it got, the defaults on it, and whether it is the shared browser
 * singleton.
 *
 * The demo opens no sockets: it builds the singleton through `getQueryClient()`
 * before the provider asks, so the GraphQL warm-up that
 * `initializeQueryClient()` fires on first construction never runs, and a fetch
 * guard counts anything that tries anyway.
 */
type QueryProviderArgs = Record<string, never>;

const meta = {
  title: 'Composites/App Shell/QueryProvider',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  render: () => ({ Component: QueryProviderDemo }),
} satisfies Meta<QueryProviderArgs>;

export default meta;
type Story = StoryObj<QueryProviderArgs>;

/**
 * A QueryClient is reachable during a child's init, and the child mounts in the
 * provider's own tick -- there is no "Loading…" gap, which is the regression
 * this component was written to fix.
 */
export const ClientInContext: Story = {};
