import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import UserProfileHandler from './UserProfileHandler.svelte';
import { loggedInStore } from '$lib/stores/auth';

/**
 * The header's account slot. It owns no state and draws no markup of its own:
 * it is config context, a query client, and `UserProfileWrapper` inside them.
 *
 * So the guarantee worth holding is the composition. `UserProfileWrapper`
 * builds a real bloc in its init body and that bloc calls `createQuery`, which
 * reads a QueryClient out of Svelte context during initialisation -- mounting
 * this bare, with no ambient provider anywhere above it, only works because
 * this component supplies one. Every assertion below is therefore also an
 * assertion that both providers are in place.
 *
 * Which of the four signed-in/out states is showing belongs to
 * `UserProfileWrapper` and its bloc, both of which have their own suites; the
 * signed-out state is used here only because it is the one a bare mount lands
 * in.
 */

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // The shared query client warms the GraphQL socket on first construction.
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
});

afterEach(() => {
  fetchSpy.mockRestore();
  loggedInStore.set({ isLoggedIn: false, isAuthInitialized: false });
});

describe('UserProfileHandler', () => {
  it('mounts with no providers above it, and renders the account slot', () => {
    render(UserProfileHandler);

    // Signed out on the desktop header: the two auth CTAs. Reaching this at all
    // means the config context and the QueryClient were both there.
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Register' })).toBeInTheDocument();
  });

  it('passes isMobile down -- the narrow header gets the menu button, not the CTAs', () => {
    render(UserProfileHandler, { props: { isMobile: true } });

    expect(screen.getByRole('button', { name: 'Open menu' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Login' })).not.toBeInTheDocument();
  });

  it('passes onProfileClick down, so the drawer host hears the tap', async () => {
    const onProfileClick = vi.fn();
    render(UserProfileHandler, { props: { isMobile: true, onProfileClick } });

    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));

    expect(onProfileClick).toHaveBeenCalledTimes(1);
  });

  it('draws no skeleton of its own -- the wrapper owns the loading state', () => {
    const { container } = render(UserProfileHandler);

    // The duplicate skeleton this component used to render while a dynamic
    // import resolved is gone; signed out, nothing pulses.
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(0);
  });
});
