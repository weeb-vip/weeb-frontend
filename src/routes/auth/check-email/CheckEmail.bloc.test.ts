import { afterEach, describe, expect, it, vi } from 'vitest';
import { writable } from 'svelte/store';
import { CheckEmailBloc, RESEND_COOLDOWN_SECONDS } from './CheckEmail.bloc.svelte';
import { realTimer, ResendBloc } from '$lib/components/auth/auth-resend.svelte';

/**
 * The screen you land on straight after registering.
 *
 * Everything it knows comes from one query parameter, so the pins here are
 * about that seam: which address is read out of the URL, what the "open your
 * inbox" button resolves to, and -- the part that costs real money if it drifts
 * -- that repeat taps on "send another" cannot fan out N identical emails.
 *
 * `ResendBloc`'s own state machine and clock are pinned in
 * `src/lib/components/auth/auth-resend.test.ts`; what is checked here is the
 * screen's wiring of it and the copy it puts in front of the user.
 */

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

interface HarnessOptions {
  search?: string;
  send?: (username: string) => Promise<unknown>;
  cooldownSeconds?: number;
}

function harness({
  search = '',
  send = vi.fn(async () => ({ ok: true })),
  cooldownSeconds = RESEND_COOLDOWN_SECONDS
}: HarnessOptions = {}) {
  const route = writable(new URLSearchParams(search));
  const resend = new ResendBloc({ send, timer: realTimer, cooldownSeconds });
  const bloc = new CheckEmailBloc({ route, resend });
  return { bloc, route, resend, send: send as ReturnType<typeof vi.fn> };
}

/** Lets the bloc's own `await`s run without leaning on a timer. */
async function flush() {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

const spies: Array<{ mockRestore: () => void }> = [];

function silence(method: 'log' | 'warn' | 'error') {
  const spy = vi.spyOn(console, method).mockImplementation(() => {});
  spies.push(spy);
  return spy;
}

afterEach(() => {
  vi.useRealTimers();
  while (spies.length) spies.pop()!.mockRestore();
});

describe('the address it was handed', () => {
  it('reads the address out of the query string rather than component state', () => {
    // The form is gone by the time this screen renders; the URL is the only
    // thing left that still knows where the link went.
    expect(harness({ search: 'email=james%40gmail.com' }).bloc.email).toBe('james@gmail.com');
  });

  it('has no address at all when the parameter is missing', () => {
    const { bloc } = harness({ search: '' });

    expect(bloc.email).toBe('');
    expect(bloc.hasEmail).toBe(false);
  });

  it('treats an empty parameter as no address', () => {
    // `?email=` is what a half-built redirect looks like, not an address.
    expect(harness({ search: 'email=' }).bloc.hasEmail).toBe(false);
  });

  it('keeps a plus-addressed local part intact through the URL round trip', () => {
    expect(harness({ search: 'email=james%2Banime%40gmail.com' }).bloc.email).toBe(
      'james+anime@gmail.com'
    );
  });

  it('follows the store when the URL underneath it changes', () => {
    const { bloc, route } = harness({ search: 'email=first%40gmail.com' });

    route.set(new URLSearchParams('email=second@gmail.com'));

    expect(bloc.email).toBe('second@gmail.com');
  });
});

describe('the way back to the inbox', () => {
  it('offers a deep link when it recognises the domain', () => {
    const { bloc } = harness({ search: 'email=james%40gmail.com' });

    expect(bloc.provider.label).toBe('Open Gmail');
    expect(bloc.provider.url).toContain('mail.google.com');
  });

  it('falls back to a generic label with no link for an unknown domain', () => {
    // A wrong deep link is worse than none, so the view renders a plain
    // instruction instead of a button when there is no URL.
    expect(harness({ search: 'email=james%40jamesat.dev' }).bloc.provider).toEqual({
      label: 'Open your email app',
      url: null
    });
  });

  it('falls back the same way when there is no address to derive one from', () => {
    expect(harness({ search: '' }).bloc.provider.url).toBeNull();
  });
});

describe('landing here without an address', () => {
  it('leaves a breadcrumb on mount, because something upstream lost the parameter', () => {
    const warn = silence('warn');

    harness({ search: '' }).bloc.start();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('CheckEmail rendered without an email query param');
  });

  it('says nothing on mount when the address is there', () => {
    const warn = silence('warn');

    harness({ search: 'email=james%40gmail.com' }).bloc.start();

    expect(warn).not.toHaveBeenCalled();
  });

  it('refuses to resend, so the button never fires into the void', async () => {
    const { bloc, send } = harness({ search: '' });

    expect(bloc.canResend).toBe(false);
    await bloc.resendEmail();

    expect(send).not.toHaveBeenCalled();
  });

  it('refuses to resend to a whitespace-only address', async () => {
    // `?email=%20` is non-empty as a string but is not somewhere an email can go.
    const { bloc, send } = harness({ search: 'email=%20%20' });

    expect(bloc.hasEmail).toBe(true);
    await bloc.resendEmail();

    expect(send).not.toHaveBeenCalled();
  });
});

describe('asking for another link', () => {
  it('sends to the address in the URL', async () => {
    silence('log');
    const { bloc, send } = harness({ search: 'email=james%40gmail.com' });

    await bloc.resendEmail();

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('james@gmail.com');
  });

  it('shows the confirmation in place of the instructions once it lands', async () => {
    silence('log');
    const { bloc } = harness({ search: 'email=james%40gmail.com' });

    expect(bloc.resentJustNow).toBe(false);
    await bloc.resendEmail();

    expect(bloc.resentJustNow).toBe(true);
    expect(bloc.resendError).toBe('');
  });

  it('does not navigate anywhere -- the whole point is that you stay put', async () => {
    silence('log');
    const { bloc } = harness({ search: 'email=james%40gmail.com' });

    await bloc.resendEmail();

    // There is no navigate port on this bloc at all: success is a state flip.
    expect(bloc.email).toBe('james@gmail.com');
    expect(bloc.resentJustNow).toBe(true);
  });
});

describe('the in-flight flag', () => {
  it('is raised while the port has not settled and lowered again on success', async () => {
    silence('log');
    const gate = deferred<unknown>();
    const { bloc } = harness({ search: 'email=james%40gmail.com', send: () => gate.promise });

    expect(bloc.isResending).toBe(false);
    const done = bloc.resendEmail();
    await flush();
    expect(bloc.isResending).toBe(true);

    gate.resolve({ ok: true });
    await done;

    expect(bloc.isResending).toBe(false);
  });

  it('is lowered on failure too, so the button comes back', async () => {
    silence('error');
    const gate = deferred<unknown>();
    const { bloc } = harness({ search: 'email=james%40gmail.com', send: () => gate.promise });

    const done = bloc.resendEmail();
    await flush();
    expect(bloc.isResending).toBe(true);

    gate.reject(new Error('nope'));
    await done;

    expect(bloc.isResending).toBe(false);
    expect(bloc.resendError).toBe("We couldn't send that again just now. Try once more in a moment.");
  });

  it('takes the button away while the request is in flight', async () => {
    const gate = deferred<unknown>();
    const { bloc } = harness({ search: 'email=james%40gmail.com', send: () => gate.promise });

    const done = bloc.resendEmail();
    await flush();

    expect(bloc.canResend).toBe(false);

    gate.resolve({ ok: true });
    silence('log');
    await done;
  });

  it('does not fan out a second email when the button is tapped twice', async () => {
    silence('log');
    const gate = deferred<unknown>();
    const send = vi.fn(() => gate.promise);
    const { bloc } = harness({ search: 'email=james%40gmail.com', send });

    const first = bloc.resendEmail();
    await flush();
    const second = bloc.resendEmail();

    gate.resolve({ ok: true });
    await Promise.all([first, second]);

    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe('when the resend fails', () => {
  it('words the failure itself rather than showing the gateway’s', async () => {
    silence('error');
    const { bloc } = harness({
      search: 'email=james%40gmail.com',
      send: async () => {
        throw new Error('Failed to fetch from Subgraph "auth-staging"');
      }
    });

    await bloc.resendEmail();

    expect(bloc.resendError).toBe("We couldn't send that again just now. Try once more in a moment.");
    expect(bloc.resentJustNow).toBe(false);
  });

  it('survives a port that rejects with something that is not an Error', async () => {
    silence('error');
    const { bloc } = harness({
      search: 'email=james%40gmail.com',
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      send: async () => {
        throw 'boom';
      }
    });

    await expect(bloc.resendEmail()).resolves.toBeUndefined();
    expect(bloc.resendError).toBe("We couldn't send that again just now. Try once more in a moment.");
  });

  it('carries no error message before anything has been tried', () => {
    expect(harness({ search: 'email=james%40gmail.com' }).bloc.resendError).toBe('');
  });
});

describe('the cooldown between links', () => {
  it('is a full minute -- long enough that repeat taps cannot fan out emails', () => {
    expect(RESEND_COOLDOWN_SECONDS).toBe(60);
  });

  it('starts at the full minute the moment a send lands', async () => {
    vi.useFakeTimers();
    silence('log');
    const { bloc } = harness({ search: 'email=james%40gmail.com' });

    await bloc.resendEmail();

    expect(bloc.isCoolingDown).toBe(true);
    expect(bloc.cooldownLabel).toBe('1:00');
  });

  it('counts down in seconds and reads as m:ss so the width never jitters', async () => {
    vi.useFakeTimers();
    silence('log');
    const { bloc } = harness({ search: 'email=james%40gmail.com' });

    await bloc.resendEmail();
    vi.advanceTimersByTime(1000);
    expect(bloc.cooldownLabel).toBe('0:59');

    vi.advanceTimersByTime(29_000);
    expect(bloc.cooldownLabel).toBe('0:30');
  });

  it('keeps the port shut for the whole minute, then opens it again', async () => {
    vi.useFakeTimers();
    silence('log');
    const gate = { calls: 0 };
    const send = vi.fn(async () => {
      gate.calls += 1;
    });
    const { bloc } = harness({ search: 'email=james%40gmail.com', send });

    await bloc.resendEmail();
    expect(send).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(59_000);
    expect(bloc.isCoolingDown).toBe(true);
    await bloc.resendEmail();
    expect(send).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    expect(bloc.isCoolingDown).toBe(false);
    expect(bloc.cooldownLabel).toBe('0:00');

    await bloc.resendEmail();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('leaves canResend true through the cooldown -- the view swaps in the countdown instead', async () => {
    // Documented rather than asserted-as-desirable: `canResend` only covers
    // "is there an address" and "is one in flight". The button is not what
    // stops a second send during the cooldown -- the port refusing is.
    vi.useFakeTimers();
    silence('log');
    const send = vi.fn(async () => ({}));
    const { bloc } = harness({ search: 'email=james%40gmail.com', send });

    await bloc.resendEmail();

    expect(bloc.isCoolingDown).toBe(true);
    expect(bloc.canResend).toBe(true);
    await bloc.resendEmail();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('does not start a clock after a failure -- a failed send has nothing to cool down', async () => {
    vi.useFakeTimers();
    silence('error');
    const { bloc } = harness({
      search: 'email=james%40gmail.com',
      send: async () => {
        throw new Error('nope');
      }
    });

    await bloc.resendEmail();

    expect(bloc.isCoolingDown).toBe(false);
    expect(bloc.cooldownLabel).toBe('0:00');
  });
});

describe('teardown', () => {
  it('kills the countdown, which would otherwise outlive the screen', async () => {
    vi.useFakeTimers();
    silence('log');
    const { bloc } = harness({ search: 'email=james%40gmail.com' });

    await bloc.resendEmail();
    expect(bloc.cooldownLabel).toBe('1:00');

    bloc.dispose();
    vi.advanceTimersByTime(10_000);

    expect(bloc.cooldownLabel).toBe('1:00');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('is safe when nothing was ever sent', () => {
    expect(() => harness({ search: 'email=james%40gmail.com' }).bloc.dispose()).not.toThrow();
  });
});
