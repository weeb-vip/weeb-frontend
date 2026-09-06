<script lang="ts">
  import { untrack } from 'svelte';
  import { readable } from 'svelte/store';
  import AuthInitializer from '$lib/components/shell/AuthInitializer';
  import {
    AuthInitializerBloc,
    type AuthSessionPort,
    type SsrAuth,
    type UserQueryPort,
  } from '$lib/components/shell/AuthInitializer';
  import ProviderPanel from './ProviderPanel.svelte';
  import { installOfflineFetch, networkRow, SESSION_USER, SSR_SIGNED_IN } from './provider-stubs';
  import type { AuthScenario, PanelRow } from './provider-stubs';

  /**
   * `AuthInitializer` renders nothing whatsoever -- it brings the client
   * session up on mount. So this shows what it DOES: every port it was given is
   * stubbed, and the panel is the session state a child would observe plus the
   * calls that got it there, in order.
   *
   * Nothing here touches the real stores. `session` is a local state object
   * rather than `loggedInStore`, and `globals` records the install instead of
   * hanging anything off the Storybook `window` -- the real one publishes
   * stores onto it, which would follow the reader into every other story.
   */
  let { scenario = 'server-signed-in' }: { scenario?: AuthScenario } = $props();

  const chosen = untrack(() => scenario);
  const fromServer = chosen.startsWith('server-');

  let requests = $state(0);
  const restoreFetch = installOfflineFetch(() => (requests += 1));

  /* ── what a child observes ─────────────────────────────────────────────── */

  let observed = $state({
    isLoggedIn: false,
    isAuthInitialized: false,
    identifiedAs: '—',
  });
  let calls = $state<string[]>([]);

  /*
    Every port below is called from inside `AuthInitializer`'s own `$effect` --
    that is what the component is. Reading this story's state there would make
    that effect depend on it, and the write on the next line would then re-run
    the whole bootstrap, forever. `untrack` keeps the bookkeeping out of the
    effect's dependencies; it still notifies the panel, which is a separate
    reader.
  */
  const record = (call: string) =>
    untrack(() => {
      calls = [...calls, call];
    });

  const observe = (next: Partial<typeof observed>) =>
    untrack(() => {
      observed = { ...observed, ...next };
    });

  /* ── the ports ─────────────────────────────────────────────────────────── */

  const session: AuthSessionPort = {
    setLoggedIn: (user) => {
      record(`session.setLoggedIn(${user ? user.username : 'no user data'})`);
      observe({
        isLoggedIn: true,
        identifiedAs: user?.username ?? 'signed in, unidentified',
      });
    },
    logout: () => {
      record('session.logout()');
      observe({ isLoggedIn: false, identifiedAs: '—' });
    },
    setAuthInitialized: () => {
      record('session.setAuthInitialized()');
      observe({ isAuthInitialized: true });
    },
  };

  const preferences = { init: () => record('preferences.init()') };

  const users = {
    fetch: async () => {
      record('users.fetch()');
      if (chosen === 'server-analytics-fails') throw new Error('gateway did not answer');
      return SESSION_USER;
    },
  };

  /** The query only runs on the no-SSR path; it answers at once, never over the wire. */
  const userQuery = (): UserQueryPort =>
    chosen === 'query-fails'
      ? (readable({ isError: true, error: { message: 'Access denied' } }) as UserQueryPort)
      : (readable({ isSuccess: true, data: SESSION_USER }) as UserQueryPort);

  const refresher = {
    startWithExpiry: (expiresAt: number) =>
      record(`refresher.startWithExpiry(${new Date(expiresAt).toISOString().slice(0, 16)}Z)`),
    start: (token: string) => record(`refresher.start(${token || 'no token'})`),
  };

  const tokens = {
    getAuthToken: () => 'auth-token-stub',
    getRefreshToken: () => 'refresh-token-stub',
    clearTokens: () => record('tokens.clearTokens()'),
  };

  /** No window writes: a story must not publish stores onto the Storybook shell. */
  const globals = {
    install: () => {
      record('globals.install()');
      return () => record('globals teardown');
    },
  };

  const bloc = new AuthInitializerBloc({
    session,
    preferences,
    users,
    userQuery,
    refresher,
    tokens,
    globals,
  });

  const ssrAuth: SsrAuth | undefined = fromServer
    ? { ...SSR_SIGNED_IN, isLoggedIn: chosen !== 'server-signed-out' }
    : undefined;

  const rows = $derived<PanelRow[]>([
    {
      label: 'route taken',
      value: fromServer ? 'server already read the cookies' : 'nothing from the server — ask the API',
    },
    {
      label: 'isLoggedIn',
      value: String(observed.isLoggedIn),
      tone: observed.isLoggedIn ? 'ok' : 'plain',
    },
    {
      label: 'isAuthInitialized',
      value: observed.isAuthInitialized
        ? 'true — everything gated on auth may render'
        : 'false — the app is still waiting',
      tone: observed.isAuthInitialized ? 'ok' : 'bad',
    },
    { label: 'identified as', value: observed.identifiedAs },
    networkRow(requests),
  ]);

  $effect(() => restoreFetch);
</script>

<div class="frame">
  <!-- The component under test. It contributes no markup; everything below is
       the story reporting what it did. -->
  <AuthInitializer {ssrAuth} {bloc} />

  <ProviderPanel
    title="What a child observes after AuthInitializer mounts"
    note="It renders nothing at all, so this is the session state it settled on and every port call that got it there. Every port is stubbed: no GraphQL, no token refresher, no stores on window."
    {rows}
  >
    <ol class="calls">
      {#each calls as call, index (index)}
        <li>{call}</li>
      {/each}
    </ol>
  </ProviderPanel>
</div>

<style>
  .frame {
    padding: 24px;
  }

  .calls {
    margin: 14px 0 0;
    padding: 0 0 0 20px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-family: var(--weeb-font-mono);
    font-size: 12px;
    color: var(--weeb-fg-secondary);
  }
</style>
