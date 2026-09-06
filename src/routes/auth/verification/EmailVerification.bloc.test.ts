import { afterEach, describe, expect, it, vi } from 'vitest';
import { readable } from 'svelte/store';
import { EmailVerificationBloc } from './EmailVerification.bloc.svelte';
import { realTimer, ResendBloc } from '$lib/components/auth/auth-resend.svelte';
import type { VerifyEmailResult } from '$lib/services/query-options';

/**
 * Redeeming a link out of a verification email.
 *
 * The link is the only input, and email clients mangle links: they cut long
 * ones in half, and they sometimes encode them twice. So the pins here are the
 * four screens this can be (`loading`, `incomplete`, `success`, `failed`), the
 * fact that redeeming a token is a write that must not fire twice, and the
 * redirect clock that hands login an address so it doesn't have to be retyped.
 *
 * `ResendBloc` is pinned in `src/lib/components/auth/auth-resend.test.ts`; only
 * this screen's wiring of it is checked here.
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

const verified: VerifyEmailResult = { success: true, userID: 'user-1' };
const notVerified: VerifyEmailResult = { success: false, userID: null };

interface HarnessOptions {
  search?: string;
  verify?: (token: string) => Promise<VerifyEmailResult>;
  redirectSeconds?: number;
  send?: (username: string) => Promise<unknown>;
}

function harness({
  search = 'email=james%40gmail.com&token=tok-123',
  verify = vi.fn(async () => verified),
  redirectSeconds = 3,
  send = vi.fn(async () => ({}))
}: HarnessOptions = {}) {
  const navigate = vi.fn();
  const resend = new ResendBloc({ send, timer: realTimer });
  const bloc = new EmailVerificationBloc({
    route: readable(new URLSearchParams(search)),
    verify,
    navigate,
    timer: realTimer,
    resend,
    redirectSeconds
  });
  return { bloc, navigate, resend, verify: verify as ReturnType<typeof vi.fn>, send };
}

/** Lets the bloc's own `await`s run without leaning on a timer. */
async function flush() {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

const spies: Array<{ mockRestore: () => void }> = [];

function silenceLogs() {
  for (const method of ['log', 'warn', 'error'] as const) {
    spies.push(vi.spyOn(console, method).mockImplementation(() => {}));
  }
}

afterEach(() => {
  vi.useRealTimers();
  while (spies.length) spies.pop()!.mockRestore();
});

describe('the state machine', () => {
  it('is loading before the token has been redeemed', () => {
    expect(harness().bloc.status).toBe('loading');
  });

  it('is incomplete the moment it sees a link with no token', () => {
    // Decided in the constructor, so the very first frame is already the right
    // screen rather than a spinner that resolves into an error.
    expect(harness({ search: 'email=james%40gmail.com' }).bloc.status).toBe('incomplete');
  });

  it('is incomplete for a link with no address either', () => {
    expect(harness({ search: 'token=tok-123' }).bloc.status).toBe('incomplete');
  });

  it('is incomplete for a link with neither', () => {
    expect(harness({ search: '' }).bloc.status).toBe('incomplete');
  });

  it('is success once the mutation says the token verified something', async () => {
    silenceLogs();
    const { bloc } = harness();

    bloc.start();
    await flush();

    expect(bloc.status).toBe('success');
  });

  it('is failed when the mutation resolves with success: false', async () => {
    // The gateway answers 200 with a false flag for a token that verified
    // nothing, so the flag decides -- not the absence of a throw.
    silenceLogs();
    const { bloc } = harness({ verify: vi.fn(async () => notVerified) });

    bloc.start();
    await flush();

    expect(bloc.status).toBe('failed');
  });

  it('is failed when the mutation resolves with nothing at all', async () => {
    silenceLogs();
    const { bloc } = harness({ verify: vi.fn(async () => null as unknown as VerifyEmailResult) });

    bloc.start();
    await flush();

    expect(bloc.status).toBe('failed');
  });

  it('is failed when the mutation throws', async () => {
    silenceLogs();
    const { bloc } = harness({
      verify: vi.fn(async () => {
        throw new Error('Access denied');
      })
    });

    bloc.start();
    await flush();

    expect(bloc.status).toBe('failed');
  });

  it('has no separate screen for an already-verified account', async () => {
    // The gateway does not distinguish it from an expired or malformed token,
    // so it lands on the same one failure state with the same recovery.
    silenceLogs();
    const { bloc } = harness({
      verify: vi.fn(async () => {
        throw new Error('email already verified');
      })
    });

    bloc.start();
    await flush();

    expect(bloc.status).toBe('failed');
    expect(bloc.title).toBe("This link didn't work");
  });

  it('survives a port that rejects with something that is not an Error', async () => {
    silenceLogs();
    const { bloc } = harness({
      verify: vi.fn(async () => {
        throw 'boom';
      })
    });

    bloc.start();
    await flush();

    expect(bloc.status).toBe('failed');
  });
});

describe('redeeming the token', () => {
  it('hands the port the token exactly as the link carried it', async () => {
    silenceLogs();
    const { bloc, verify } = harness({ search: 'email=a%40b.com&token=abc.def-123' });

    bloc.start();
    await flush();

    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify).toHaveBeenCalledWith('abc.def-123');
  });

  it('does not redeem twice, because redeeming is a write', async () => {
    silenceLogs();
    const { bloc, verify } = harness();

    bloc.start();
    bloc.start();
    await flush();
    bloc.start();
    await flush();

    expect(verify).toHaveBeenCalledTimes(1);
  });

  it('never calls the port for an incomplete link', async () => {
    const { bloc, verify } = harness({ search: 'email=james%40gmail.com' });

    bloc.start();
    await flush();

    expect(verify).not.toHaveBeenCalled();
    expect(bloc.status).toBe('incomplete');
  });

  it('is in flight -- still loading -- until the port settles', async () => {
    silenceLogs();
    const gate = deferred<VerifyEmailResult>();
    const { bloc } = harness({ verify: () => gate.promise });

    bloc.start();
    await flush();
    expect(bloc.status).toBe('loading');

    gate.resolve(verified);
    await flush();
    expect(bloc.status).toBe('success');
  });
});

describe('retrying a link that did not work', () => {
  it('goes back to loading and asks again', async () => {
    silenceLogs();
    let answer: VerifyEmailResult = notVerified;
    const verify = vi.fn(async () => answer);
    const { bloc } = harness({ verify });

    bloc.start();
    await flush();
    expect(bloc.status).toBe('failed');

    answer = verified;
    bloc.retry();
    expect(bloc.status).toBe('loading');
    await flush();

    expect(bloc.status).toBe('success');
    expect(verify).toHaveBeenCalledTimes(2);
  });

  it('is a no-op when there was never a token to retry', async () => {
    const { bloc, verify } = harness({ search: 'email=james%40gmail.com' });

    bloc.retry();
    await flush();

    expect(verify).not.toHaveBeenCalled();
    expect(bloc.status).toBe('incomplete');
  });

  it('redeems a half-link that still has a token, unlike start', async () => {
    // `retry` guards on the token alone, so it will pull an `incomplete` screen
    // out of that state where `start` refuses to. Not reachable from the view
    // -- the retry button is only rendered on the failure screen -- but it is
    // the only way the address-less copy below can be produced at all.
    silenceLogs();
    const { bloc, verify } = harness({ search: 'token=tok-123' });

    expect(bloc.status).toBe('incomplete');
    bloc.retry();
    await flush();

    expect(verify).toHaveBeenCalledWith('tok-123');
    expect(bloc.status).toBe('success');
  });
});

describe('the address in the link', () => {
  it('is empty when the link never carried one', () => {
    expect(harness({ search: 'token=tok-123' }).bloc.email).toBe('');
  });

  it('undoes a second round of encoding, which some clients add', () => {
    // `URLSearchParams` decoded it once already; a doubly-encoded link would
    // otherwise show `james%40gmail.com` on screen.
    expect(harness({ search: 'email=james%2540gmail.com&token=t' }).bloc.email).toBe(
      'james@gmail.com'
    );
  });

  it('leaves an address alone when decoding it again would throw', () => {
    // A lone `%` is not a valid escape; `decodeURIComponent` throws on it.
    expect(harness({ search: 'email=100%25%40gmail.com&token=t' }).bloc.email).toBe('100%@gmail.com');
  });
});

describe('where it sends you next', () => {
  it('hands login the address so it does not have to be typed again', () => {
    // Verification proves ownership but returns no credentials, so a session
    // cannot be minted here -- prefilling the login form is the next best thing.
    expect(harness().bloc.loginHref).toBe('/auth/login?email=james%40gmail.com');
  });

  it('encodes an address with characters that would break the query string', () => {
    expect(harness({ search: 'email=a%2Bb%40gmail.com&token=t' }).bloc.loginHref).toBe(
      '/auth/login?email=a%2Bb%40gmail.com'
    );
  });

  it('falls back to a bare login link when there is no address', () => {
    expect(harness({ search: 'token=tok-123' }).bloc.loginHref).toBe('/auth/login');
  });
});

describe('the redirect clock', () => {
  it('starts at the configured number of seconds and counts down', async () => {
    vi.useFakeTimers();
    silenceLogs();
    const { bloc } = harness({ redirectSeconds: 3 });

    bloc.start();
    await flush();
    expect(bloc.redirectIn).toBe(3);

    vi.advanceTimersByTime(1000);
    expect(bloc.redirectIn).toBe(2);

    vi.advanceTimersByTime(1000);
    expect(bloc.redirectIn).toBe(1);
  });

  it('navigates to the prefilled login link when it reaches zero', async () => {
    vi.useFakeTimers();
    silenceLogs();
    const { bloc, navigate } = harness({ redirectSeconds: 3 });

    bloc.start();
    await flush();
    vi.advanceTimersByTime(2000);
    expect(navigate).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/auth/login?email=james%40gmail.com');
    expect(bloc.redirectIn).toBe(0);
  });

  it('stops its own clock at zero rather than navigating over and over', async () => {
    vi.useFakeTimers();
    silenceLogs();
    const { bloc, navigate } = harness({ redirectSeconds: 1 });

    bloc.start();
    await flush();
    vi.advanceTimersByTime(20_000);

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(bloc.redirectIn).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not start at all when verification failed', async () => {
    vi.useFakeTimers();
    silenceLogs();
    const { bloc, navigate } = harness({ verify: vi.fn(async () => notVerified) });

    bloc.start();
    await flush();
    vi.advanceTimersByTime(30_000);

    expect(navigate).not.toHaveBeenCalled();
    expect(bloc.redirectIn).toBe(3);
  });

  it('does not run for an incomplete link', async () => {
    vi.useFakeTimers();
    const { bloc, navigate } = harness({ search: '' });

    bloc.start();
    await flush();
    vi.advanceTimersByTime(30_000);

    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('the copy for each screen', () => {
  it('says what it is doing while the token is in flight, naming the address', () => {
    const { bloc } = harness();

    expect(bloc.title).toBe('Verifying your email');
    expect(bloc.subtitle).toBe('Confirming james@gmail.com…');
  });

  it('stays vague while loading when it does not know the address', () => {
    // A link with no address never loads on its own -- it is `incomplete` from
    // the first frame -- so `retry` is what puts it into `loading` here.
    const gate = deferred<VerifyEmailResult>();
    const { bloc } = harness({ search: 'token=tok-123', verify: () => gate.promise });

    bloc.retry();

    expect(bloc.status).toBe('loading');
    expect(bloc.subtitle).toBe('One moment…');
  });

  it('confirms the account is active on success', async () => {
    silenceLogs();
    const { bloc } = harness();

    bloc.start();
    await flush();

    expect(bloc.title).toBe("You're verified");
    expect(bloc.subtitle).toBe('james@gmail.com is confirmed and your account is active.');
  });

  it('confirms without naming an address it does not have', async () => {
    silenceLogs();
    const { bloc } = harness({ search: 'token=tok-123' });

    bloc.retry();
    await flush();

    expect(bloc.status).toBe('success');
    expect(bloc.subtitle).toBe('Your email is confirmed and your account is active.');
  });

  it('names the likeliest cause on failure and offers a fresh link', async () => {
    silenceLogs();
    const { bloc } = harness({ verify: vi.fn(async () => notVerified) });

    bloc.start();
    await flush();

    expect(bloc.title).toBe("This link didn't work");
    expect(bloc.subtitle).toBe(
      "Verification links expire 15 minutes after they're sent. We can send a fresh one to james@gmail.com."
    );
  });

  it('sends you to the login page for a fresh link when it has no address', async () => {
    silenceLogs();
    const { bloc } = harness({ search: 'token=tok-123', verify: vi.fn(async () => notVerified) });

    bloc.retry();
    await flush();

    expect(bloc.subtitle).toBe(
      "Verification links expire 15 minutes after they're sent. Request a new one from the log in page."
    );
  });

  it('blames the email client, not the user, for a truncated link', () => {
    const { bloc } = harness({ search: 'email=james%40gmail.com' });

    expect(bloc.title).toBe('This link is incomplete');
    expect(bloc.subtitle).toContain('cut long links in half');
  });
});

describe('sending a fresh link', () => {
  it('is offered only from the failure screen', async () => {
    silenceLogs();
    const { bloc } = harness({ verify: vi.fn(async () => notVerified) });

    expect(bloc.canResend).toBe(false);

    bloc.start();
    await flush();

    expect(bloc.canResend).toBe(true);
  });

  it('is not offered after a success', async () => {
    silenceLogs();
    const { bloc } = harness();

    bloc.start();
    await flush();

    expect(bloc.canResend).toBe(false);
  });

  it('is not offered when it does not know where to send it', async () => {
    silenceLogs();
    const { bloc } = harness({ search: 'token=tok-123', verify: vi.fn(async () => notVerified) });

    bloc.retry();
    await flush();

    expect(bloc.status).toBe('failed');
    expect(bloc.canResend).toBe(false);
  });

  it('sends to the decoded address and reports whether it landed', async () => {
    const send = vi.fn(async () => ({}));
    const { bloc } = harness({ search: 'email=james%2540gmail.com&token=t', send });

    await expect(bloc.resendLink()).resolves.toBe(true);
    expect(send).toHaveBeenCalledWith('james@gmail.com');
  });

  it('reports a failure back rather than throwing out of the click handler', async () => {
    const { bloc } = harness({
      send: async () => {
        throw new Error('nope');
      }
    });

    await expect(bloc.resendLink()).resolves.toBe(false);
    expect(bloc.resend.isFailed).toBe(true);
  });
});

describe('teardown', () => {
  it('kills the redirect clock, so a left screen cannot navigate behind you', async () => {
    vi.useFakeTimers();
    silenceLogs();
    const { bloc, navigate } = harness({ redirectSeconds: 3 });

    bloc.start();
    await flush();
    bloc.dispose();
    vi.advanceTimersByTime(30_000);

    expect(navigate).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('is safe on a screen where no clock ever started', () => {
    expect(() => harness({ search: '' }).bloc.dispose()).not.toThrow();
  });
});
