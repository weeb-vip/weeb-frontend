import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResendVerificationBloc } from './ResendVerification.bloc.svelte';
import { realTimer, ResendBloc } from '$lib/components/auth/auth-resend.svelte';

/**
 * The standalone "send me another verification link" page.
 *
 * It is thin over `ResendBloc` -- whose state machine and clock are pinned in
 * `src/lib/components/auth/auth-resend.test.ts` -- so what is checked here is
 * the part that is this screen's own: the address field, the gate in front of
 * the port, and the fact that this is the one screen that has to *explain* a
 * failure rather than just show one. The exact strings are the contract; they
 * are what the user reads.
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

function harness(send: (username: string) => Promise<unknown> = vi.fn(async () => ({}))) {
  const resend = new ResendBloc({ send, timer: realTimer, cooldownSeconds: 0 });
  const bloc = new ResendVerificationBloc({ resend });
  return { bloc, resend, send: send as ReturnType<typeof vi.fn> };
}

/** Fills the field the way the view does, then submits. */
async function submitWith(
  address: string,
  send: (username: string) => Promise<unknown> = vi.fn(async () => ({}))
) {
  const kit = harness(send);
  kit.bloc.updateField('username', address);
  await kit.bloc.submit();
  return kit;
}

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

describe('the field', () => {
  it('starts empty, with nothing to say', () => {
    const { bloc } = harness();

    expect(bloc.username).toBe('');
    expect(bloc.errorMessage).toBe('');
    expect(bloc.successMessage).toBe('');
    expect(bloc.isSubmitting).toBe(false);
  });

  it('records what was typed', () => {
    const { bloc } = harness();

    bloc.updateField('username', 'james@gmail.com');

    expect(bloc.username).toBe('james@gmail.com');
  });

  it('ignores a field it does not own', () => {
    const { bloc } = harness();

    bloc.updateField('password', 'hunter2');

    expect(bloc.username).toBe('');
  });

  it('clears a stale error as soon as the address changes under it', async () => {
    // Both messages describe the address that was in the box a moment ago.
    const { bloc } = await submitWith('not-an-email');
    expect(bloc.errorMessage).not.toBe('');

    bloc.updateField('username', 'not-an-email@');

    expect(bloc.errorMessage).toBe('');
  });

  it('clears a stale success the same way', async () => {
    silenceLogs();
    const { bloc } = await submitWith('james@gmail.com');
    expect(bloc.successMessage).not.toBe('');

    bloc.updateField('username', 'someone@else.com');

    expect(bloc.successMessage).toBe('');
  });
});

describe('validation stands in front of the port', () => {
  it('asks for an address rather than sending nothing', async () => {
    const { bloc, send } = await submitWith('');

    expect(bloc.errorMessage).toBe('Please enter your email address.');
    expect(send).not.toHaveBeenCalled();
  });

  it('treats a field of spaces as empty', async () => {
    const { bloc, send } = await submitWith('   ');

    expect(bloc.errorMessage).toBe('Please enter your email address.');
    expect(send).not.toHaveBeenCalled();
  });

  it('rejects an address with no @ at all', async () => {
    const { bloc, send } = await submitWith('james');

    expect(bloc.errorMessage).toBe('Please enter a valid email address.');
    expect(send).not.toHaveBeenCalled();
  });

  it('rejects an address with no domain dot', async () => {
    const { bloc, send } = await submitWith('james@localhost');

    expect(bloc.errorMessage).toBe('Please enter a valid email address.');
    expect(send).not.toHaveBeenCalled();
  });

  it('rejects a trailing @ with nothing after it', async () => {
    const { bloc, send } = await submitWith('james@');

    expect(bloc.errorMessage).toBe('Please enter a valid email address.');
    expect(send).not.toHaveBeenCalled();
  });

  it('does NOT trim a pasted address, so surrounding space is a validation error', async () => {
    // Current behaviour, pinned as-is: the blank check trims but the pattern
    // check does not, so ` james@gmail.com ` -- which is what pasting from a
    // mail client gives you -- is rejected as malformed rather than cleaned up.
    const leading = await submitWith(' james@gmail.com');
    expect(leading.bloc.errorMessage).toBe('Please enter a valid email address.');
    expect(leading.send).not.toHaveBeenCalled();

    const trailing = await submitWith('james@gmail.com ');
    expect(trailing.bloc.errorMessage).toBe('Please enter a valid email address.');
    expect(trailing.send).not.toHaveBeenCalled();
  });

  it('lets an ordinary address through', async () => {
    silenceLogs();
    const { send } = await submitWith('james@gmail.com');

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('james@gmail.com');
  });

  it('lets a plus-addressed one through', async () => {
    silenceLogs();
    const { send } = await submitWith('james+anime@gmail.com');

    expect(send).toHaveBeenCalledWith('james+anime@gmail.com');
  });
});

describe('the in-flight flag', () => {
  it('is raised while the port has not settled and lowered on success', async () => {
    silenceLogs();
    const gate = deferred<unknown>();
    const { bloc } = harness(() => gate.promise);
    bloc.updateField('username', 'james@gmail.com');

    const done = bloc.submit();
    await flush();
    expect(bloc.isSubmitting).toBe(true);

    gate.resolve({});
    await done;

    expect(bloc.isSubmitting).toBe(false);
  });

  it('is lowered on failure too', async () => {
    silenceLogs();
    const gate = deferred<unknown>();
    const { bloc } = harness(() => gate.promise);
    bloc.updateField('username', 'james@gmail.com');

    const done = bloc.submit();
    await flush();
    expect(bloc.isSubmitting).toBe(true);

    gate.reject(new Error('nope'));
    await done;

    expect(bloc.isSubmitting).toBe(false);
  });

  it('is never raised for a submit validation refused', async () => {
    const { bloc } = await submitWith('nope');

    expect(bloc.isSubmitting).toBe(false);
  });

  it('does not send a second email when submit is fired twice in flight', async () => {
    silenceLogs();
    const gate = deferred<unknown>();
    const send = vi.fn(() => gate.promise);
    const { bloc } = harness(send);
    bloc.updateField('username', 'james@gmail.com');

    const first = bloc.submit();
    await flush();
    const second = bloc.submit();

    gate.resolve({});
    await Promise.all([first, second]);

    expect(send).toHaveBeenCalledTimes(1);
  });

  it('but shows a failure banner for that refused second submit', async () => {
    // Pinned as current behaviour, not endorsed: the second submit is correctly
    // a no-op at the port, yet it words the refusal as an error the user cannot
    // act on -- and it wipes the success message the first send just produced.
    silenceLogs();
    const gate = deferred<unknown>();
    const { bloc } = harness(() => gate.promise);
    bloc.updateField('username', 'james@gmail.com');

    const first = bloc.submit();
    await flush();
    const second = bloc.submit();
    await second;

    expect(bloc.errorMessage).toBe('Failed to send verification email. Please try again.');

    gate.resolve({});
    await first;
  });
});

describe('when it lands', () => {
  it('says so, and points at the spam folder as well as the inbox', async () => {
    silenceLogs();
    const { bloc } = await submitWith('james@gmail.com');

    expect(bloc.successMessage).toBe(
      'Verification email sent! Please check your inbox and spam folder.'
    );
    expect(bloc.errorMessage).toBe('');
  });

  it('empties the field, so a second send is a deliberate retype', async () => {
    silenceLogs();
    const { bloc } = await submitWith('james@gmail.com');

    expect(bloc.username).toBe('');
  });

  it('does not navigate -- this screen becomes its own confirmation', async () => {
    silenceLogs();
    const { bloc } = await submitWith('james@gmail.com');

    // Nothing to assert a navigate against: the bloc takes no navigate port at
    // all. Success is the message plus the emptied field, and nothing else.
    expect(bloc.successMessage).not.toBe('');
    expect(bloc.isSubmitting).toBe(false);
  });

  it('imposes no cooldown here, unlike the check-email screen', async () => {
    // This page asks for the address every time, so a repeat send already costs
    // a retype; a minute-long countdown on top would only be in the way.
    silenceLogs();
    const send = vi.fn(async () => ({}));
    const { bloc } = await submitWith('james@gmail.com', send);

    expect(bloc.resend.isCoolingDown).toBe(false);

    bloc.updateField('username', 'james@gmail.com');
    await bloc.submit();

    expect(send).toHaveBeenCalledTimes(2);
  });

  it('immediately submitting again with the emptied field asks for an address', async () => {
    silenceLogs();
    const { bloc, send } = await submitWith('james@gmail.com');

    await bloc.submit();

    expect(bloc.errorMessage).toBe('Please enter your email address.');
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe('explaining a failure', () => {
  const failing = (message: string) => async () => {
    throw new Error(message);
  };

  it('tells an unknown address it is unknown, and to check it', async () => {
    silenceLogs();
    const { bloc } = await submitWith('james@gmail.com', failing('User not found'));

    expect(bloc.errorMessage).toBe(
      'No account found with this email address. Please check and try again.'
    );
  });

  it('sends an already-verified account to the login form instead', async () => {
    silenceLogs();
    const { bloc } = await submitWith('james@gmail.com', failing('email already verified'));

    expect(bloc.errorMessage).toBe('Your email is already verified. You can proceed to login.');
  });

  it('names a connection failure as one', async () => {
    silenceLogs();
    const { bloc } = await submitWith('james@gmail.com', failing('network request failed'));

    expect(bloc.errorMessage).toBe('Network error. Please check your connection and try again.');
  });

  it('names a failed fetch as a connection failure too', async () => {
    silenceLogs();
    const { bloc } = await submitWith('james@gmail.com', failing('Failed to fetch'));

    expect(bloc.errorMessage).toBe('Network error. Please check your connection and try again.');
  });

  it('has no rung for a rate limit, so the gateway’s own wording is shown', async () => {
    // Pinned as current behaviour: there is no throttling branch, so a 429
    // surfaces verbatim rather than as "wait a moment and try again".
    silenceLogs();
    const { bloc } = await submitWith('james@gmail.com', failing('429 Too Many Requests'));

    expect(bloc.errorMessage).toBe('429 Too Many Requests');
  });

  it('falls back to its own copy for a throw it recognises nothing in', async () => {
    silenceLogs();
    const { bloc } = await submitWith('james@gmail.com', failing(''));

    expect(bloc.errorMessage).toBe('Failed to send verification email. Please try again.');
  });

  it('survives -- and words -- a rejection that is not an Error at all', async () => {
    silenceLogs();
    const { bloc } = await submitWith('james@gmail.com', async () => {
      throw 'boom';
    });

    expect(bloc.errorMessage).toBe('Failed to send verification email. Please try again.');
  });

  it('survives a rejection with no value at all', async () => {
    silenceLogs();
    const { bloc } = harness(async () => {
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw undefined;
    });
    bloc.updateField('username', 'james@gmail.com');

    await expect(bloc.submit()).resolves.toBeUndefined();
    expect(bloc.errorMessage).toBe('Failed to send verification email. Please try again.');
  });

  it('keeps the address in the field so the failure can be retried', async () => {
    silenceLogs();
    const { bloc } = await submitWith('james@gmail.com', failing('User not found'));

    expect(bloc.username).toBe('james@gmail.com');
    expect(bloc.successMessage).toBe('');
  });

  it('lets the retry through once the port recovers', async () => {
    silenceLogs();
    let broken = true;
    const send = vi.fn(async () => {
      if (broken) throw new Error('network');
      return {};
    });
    const { bloc } = harness(send);

    bloc.updateField('username', 'james@gmail.com');
    await bloc.submit();
    expect(bloc.errorMessage).not.toBe('');

    broken = false;
    bloc.updateField('username', 'james@gmail.com');
    await bloc.submit();

    expect(bloc.errorMessage).toBe('');
    expect(bloc.successMessage).not.toBe('');
    expect(send).toHaveBeenCalledTimes(2);
  });
});

describe('teardown', () => {
  it('hands dispose down to the sub-bloc that owns the timer', () => {
    const { bloc, resend } = harness();
    const dispose = vi.spyOn(resend, 'dispose');

    bloc.dispose();

    expect(dispose).toHaveBeenCalledTimes(1);
    dispose.mockRestore();
  });
});
