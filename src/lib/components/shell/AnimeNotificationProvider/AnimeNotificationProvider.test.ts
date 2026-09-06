import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  AnimeNotificationProviderBloc,
  browserSessionOnce
} from './AnimeNotificationProvider.bloc.svelte';

/** A guard that lets exactly the first caller through, like the real one. */
function once() {
  let claimed = false;
  return {
    claim: vi.fn(() => {
      if (claimed) return false;
      claimed = true;
      return true;
    })
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('AnimeNotificationProviderBloc', () => {
  it('brings the notification manager up', async () => {
    const notifications = { initialize: vi.fn(async () => {}) };

    new AnimeNotificationProviderBloc({ notifications, once: once() }).start();
    await settle();

    expect(notifications.initialize).toHaveBeenCalledTimes(1);
  });

  it('starts nothing at all when the session has already claimed it', () => {
    const notifications = { initialize: vi.fn(async () => {}) };

    new AnimeNotificationProviderBloc({
      notifications,
      once: { claim: () => false }
    }).start();

    expect(notifications.initialize).not.toHaveBeenCalled();
  });

  it('starts once however many times the component remounts', () => {
    const notifications = { initialize: vi.fn(async () => {}) };
    const guard = once();
    const bloc = new AnimeNotificationProviderBloc({ notifications, once: guard });

    bloc.start();
    bloc.start();
    bloc.start();

    // The component remounts on every layout re-render.
    expect(notifications.initialize).toHaveBeenCalledTimes(1);
  });

  it('swallows a failed start rather than taking the page down with it', async () => {
    const notifications = {
      initialize: vi.fn(async () => Promise.reject(new Error('no service worker')))
    };

    expect(() =>
      new AnimeNotificationProviderBloc({ notifications, once: once() }).start()
    ).not.toThrow();
    await settle();
  });
});

describe('browserSessionOnce', () => {
  afterEach(() => {
    delete (window as { __animeNotificationsComponentMounted?: boolean })
      .__animeNotificationsComponentMounted;
  });

  it('lets the first caller through and nobody after', () => {
    expect(browserSessionOnce.claim()).toBe(true);
    expect(browserSessionOnce.claim()).toBe(false);
    expect(browserSessionOnce.claim()).toBe(false);
  });

  it('marks the window, so the claim survives client-side navigation', () => {
    browserSessionOnce.claim();

    expect(
      (window as { __animeNotificationsComponentMounted?: boolean })
        .__animeNotificationsComponentMounted
    ).toBe(true);
  });
});
