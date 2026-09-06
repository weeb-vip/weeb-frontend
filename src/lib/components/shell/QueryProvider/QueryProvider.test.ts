import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { QueryClient } from '@tanstack/svelte-query';
import QueryProvider from './QueryProvider.svelte';
import ProviderHarness from '../../__tests__/ProviderHarness.svelte';
import QueryClientProbe from '../../__tests__/QueryClientProbe.svelte';
import { getQueryClient } from '$lib/services/query-client';

/**
 * QueryProvider renders no markup of its own, so what is tested is the two
 * things it promises.
 *
 * The first is the regression it was written for: the seven copies of this it
 * replaced each did an `onMount` + dynamic `import()` and rendered a
 * "Loading..." branch until it resolved, which meant every child mounted a
 * tick late and none of them SSR'd. With a static import the child is there in
 * the same tick as the provider -- so the assertion is that the child is in
 * the document synchronously after `render`, with nothing awaited.
 *
 * The second is that a child can reach a QueryClient at all, which is what
 * `createQuery` needs during initialisation. `useQueryClient` throws when
 * there is none, so mounting the probe inside the provider IS that assertion.
 */

/** The provider's client is the shared browser singleton, which warms itself
 *  with a fire-and-forget request. Nothing in a unit test may hit a socket. */
let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
});

afterEach(() => {
  fetchSpy.mockRestore();
});

function clientSeenByChild(): unknown {
  const onClient = vi.fn();
  render(ProviderHarness, {
    props: { provider: QueryProvider, probe: QueryClientProbe, probeProps: { onClient } }
  });

  expect(onClient).toHaveBeenCalledTimes(1);
  return onClient.mock.calls[0][0];
}

describe('QueryProvider', () => {
  it('mounts its child in the same tick -- there is no loading branch to wait on', () => {
    render(ProviderHarness, {
      props: {
        provider: QueryProvider,
        probe: QueryClientProbe,
        probeProps: { onClient: () => {} }
      }
    });

    // No `await`, no `waitFor`: if the provider still deferred behind a dynamic
    // import, this query would find the old "Loading..." text instead.
    expect(screen.getByTestId('query-probe')).toBeInTheDocument();
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  it('puts a QueryClient where a child can reach it during initialisation', () => {
    expect(clientSeenByChild()).toBeInstanceOf(QueryClient);
  });

  /**
   * In the browser every provider shares one client, so a header and a page
   * that both mount one do not end up with two caches of the same user.
   * (The server's fresh-client-per-request half of that rule cannot be
   * exercised here: jsdom always has a `window`.)
   */
  it('shares the one browser client rather than building a second cache', () => {
    const first = clientSeenByChild();
    const second = clientSeenByChild();

    expect(first).toBe(second);
    expect(first).toBe(getQueryClient());
  });
});
