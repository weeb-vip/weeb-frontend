import { afterEach, describe, expect, it, vi } from 'vitest';
import { PasswordResetRequestBloc } from './PasswordResetRequest.bloc.svelte';
import type { PasswordResetRequestPort } from '$lib/components/auth/auth-shared';

/**
 * Asking for a password-reset link.
 *
 * A reset email is the one auth action you cannot un-send, so the rules worth
 * pinning are all about the form locking: it locks the instant a request is in
 * flight, it *stays* locked once one succeeds, and Enter/Space cannot slip a
 * second request past the disabled attribute.
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

function harness(request: PasswordResetRequestPort = vi.fn(async () => true)) {
  const bloc = new PasswordResetRequestBloc({ request });
  return { bloc, request: request as ReturnType<typeof vi.fn> };
}

/** Fills both fields the way the view does. */
function fill(bloc: PasswordResetRequestBloc, username: string, email: string) {
  bloc.updateField('username', username);
  bloc.updateField('email', email);
}

async function flush() {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

function keyEvent(key: string) {
  return {
    key,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn()
  } as unknown as KeyboardEvent & { preventDefault: ReturnType<typeof vi.fn>; stopPropagation: ReturnType<typeof vi.fn> };
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

describe('the fields', () => {
  it('start empty, unlocked and unsubmitted', () => {
    const { bloc } = harness();

    expect(bloc.username).toBe('');
    expect(bloc.email).toBe('');
    expect(bloc.errorMessage).toBe('');
    expect(bloc.submitted).toBe(false);
    expect(bloc.isSubmitting).toBe(false);
    expect(bloc.isDisabled).toBe(false);
  });

  it('records each field separately', () => {
    const { bloc } = harness();

    fill(bloc, 'jamesat', 'james@gmail.com');

    expect(bloc.username).toBe('jamesat');
    expect(bloc.email).toBe('james@gmail.com');
  });

  it('ignores a field it does not own', () => {
    const { bloc } = harness();

    bloc.updateField('password', 'hunter2');

    expect(bloc.username).toBe('');
    expect(bloc.email).toBe('');
  });

  it('clears a stale error as soon as either field changes under it', async () => {
    const { bloc } = harness();
    await bloc.submit();
    expect(bloc.errorMessage).not.toBe('');

    bloc.updateField('username', 'j');

    expect(bloc.errorMessage).toBe('');
  });
});

describe('validation stands in front of the port', () => {
  it('refuses an empty form and says so once, not twice', async () => {
    const { bloc, request } = harness();

    await bloc.submit();

    expect(bloc.errorMessage).toBe('Please fill in all fields');
    expect(request).not.toHaveBeenCalled();
  });

  it('refuses a form with only a username', async () => {
    const { bloc, request } = harness();
    bloc.updateField('username', 'jamesat');

    await bloc.submit();

    expect(bloc.errorMessage).toBe('Please fill in all fields');
    expect(request).not.toHaveBeenCalled();
  });

  it('refuses a form with only an address', async () => {
    const { bloc, request } = harness();
    bloc.updateField('email', 'james@gmail.com');

    await bloc.submit();

    expect(bloc.errorMessage).toBe('Please fill in all fields');
    expect(request).not.toHaveBeenCalled();
  });

  it('treats fields of whitespace as empty', async () => {
    const { bloc, request } = harness();
    fill(bloc, '   ', '\t\n ');

    await bloc.submit();

    expect(bloc.errorMessage).toBe('Please fill in all fields');
    expect(request).not.toHaveBeenCalled();
  });

  it('leaves the form usable after a refusal, unlike after a send', async () => {
    const { bloc } = harness();

    await bloc.submit();

    expect(bloc.isDisabled).toBe(false);
    expect(bloc.isSubmitting).toBe(false);
  });

  it('checks the address is shaped like one, the way the resend screen does', async () => {
    // This screen used to have no `EMAIL_PATTERN` gate, so a value with no @
    // reached the gateway and the user only learned it was wrong from an email
    // that never arrived. Same gate, same wording, as /auth/resend-verification.
    silenceLogs();
    const { bloc, request } = harness();
    fill(bloc, 'jamesat', 'not-an-email');

    await bloc.submit();

    expect(bloc.errorMessage).toBe('Please enter a valid email address.');
    expect(request).not.toHaveBeenCalled();
    expect(bloc.submitted).toBe(false);
  });

  it('refuses an address with no domain dot, or nothing after the @', async () => {
    for (const bad of ['james@localhost', 'james@', '@gmail.com', 'james gmail.com']) {
      const { bloc, request } = harness();
      fill(bloc, 'jamesat', bad);

      await bloc.submit();

      expect(bloc.errorMessage).toBe('Please enter a valid email address.');
      expect(request).not.toHaveBeenCalled();
    }
  });

  it('leaves the form usable after a malformed address, so it can be corrected', async () => {
    const { bloc } = harness();
    fill(bloc, 'jamesat', 'not-an-email');

    await bloc.submit();

    expect(bloc.isDisabled).toBe(false);
    expect(bloc.isSubmitting).toBe(false);
  });

  it('trims both fields on the way to the port', async () => {
    // ` james@gmail.com ` is what pasting from a mail client gives you; it is
    // the same address, so it is cleaned up rather than refused as malformed.
    silenceLogs();
    const { bloc, request } = harness();
    fill(bloc, ' jamesat ', ' james@gmail.com ');

    await bloc.submit();

    expect(request).toHaveBeenCalledWith({ username: 'jamesat', email: 'james@gmail.com' });
    expect(bloc.submitted).toBe(true);
    // The boxes keep what the user typed; only what is sent is cleaned.
    expect(bloc.email).toBe(' james@gmail.com ');
  });
});

describe('the in-flight lock', () => {
  it('raises isSubmitting while the port has not settled', async () => {
    silenceLogs();
    const gate = deferred<boolean>();
    const { bloc } = harness(() => gate.promise);
    fill(bloc, 'jamesat', 'james@gmail.com');

    const done = bloc.submit();
    await flush();

    expect(bloc.isSubmitting).toBe(true);
    expect(bloc.isDisabled).toBe(true);

    gate.resolve(true);
    await done;
  });

  it('lowers it again on failure, so the form comes back', async () => {
    silenceLogs();
    const gate = deferred<boolean>();
    const { bloc } = harness(() => gate.promise);
    fill(bloc, 'jamesat', 'james@gmail.com');

    const done = bloc.submit();
    await flush();
    gate.reject(new Error('nope'));
    await done;

    expect(bloc.isSubmitting).toBe(false);
    expect(bloc.isDisabled).toBe(false);
  });

  it('lowers it on success too -- but the form stays disabled', async () => {
    // Nothing is in flight any more, yet there is nothing left to submit
    // either: the screen has become a confirmation.
    silenceLogs();
    const { bloc } = harness();
    fill(bloc, 'jamesat', 'james@gmail.com');

    await bloc.submit();

    expect(bloc.isSubmitting).toBe(false);
    expect(bloc.isDisabled).toBe(true);
  });

  it('does not send a second email when submit is fired twice in flight', async () => {
    silenceLogs();
    const gate = deferred<boolean>();
    const request = vi.fn(() => gate.promise);
    const { bloc } = harness(request);
    fill(bloc, 'jamesat', 'james@gmail.com');

    const first = bloc.submit();
    await flush();
    const second = bloc.submit();

    gate.resolve(true);
    await Promise.all([first, second]);

    expect(request).toHaveBeenCalledTimes(1);
  });

  it('says nothing about that refused second submit -- it is not the user’s mistake', async () => {
    silenceLogs();
    const gate = deferred<boolean>();
    const { bloc } = harness(() => gate.promise);
    fill(bloc, 'jamesat', 'james@gmail.com');

    const first = bloc.submit();
    await flush();
    await bloc.submit();

    expect(bloc.errorMessage).toBe('');

    gate.resolve(true);
    await first;
  });

  it('is still inert after the request has succeeded', async () => {
    silenceLogs();
    const { bloc, request } = harness();
    fill(bloc, 'jamesat', 'james@gmail.com');

    await bloc.submit();
    await bloc.submit();

    expect(request).toHaveBeenCalledTimes(1);
  });
});

describe('the keyboard, which is the other way to fire a locked form', () => {
  it('swallows Enter while a request is in flight', async () => {
    silenceLogs();
    const gate = deferred<boolean>();
    const { bloc } = harness(() => gate.promise);
    fill(bloc, 'jamesat', 'james@gmail.com');
    const done = bloc.submit();
    await flush();

    const event = keyEvent('Enter');
    bloc.handleKeyDown(event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);

    gate.resolve(true);
    await done;
  });

  it('swallows Space, under both of the names browsers give it', async () => {
    silenceLogs();
    const gate = deferred<boolean>();
    const { bloc } = harness(() => gate.promise);
    fill(bloc, 'jamesat', 'james@gmail.com');
    const done = bloc.submit();
    await flush();

    for (const key of [' ', 'Spacebar']) {
      const event = keyEvent(key);
      bloc.handleKeyDown(event);
      expect(event.preventDefault).toHaveBeenCalledTimes(1);
    }

    gate.resolve(true);
    await done;
  });

  it('lets every other key through, so the form is still readable and navigable', async () => {
    silenceLogs();
    const gate = deferred<boolean>();
    const { bloc } = harness(() => gate.promise);
    fill(bloc, 'jamesat', 'james@gmail.com');
    const done = bloc.submit();
    await flush();

    for (const key of ['Tab', 'Escape', 'a', 'ArrowDown']) {
      const event = keyEvent(key);
      bloc.handleKeyDown(event);
      expect(event.preventDefault).not.toHaveBeenCalled();
    }

    gate.resolve(true);
    await done;
  });

  it('does nothing at all before anything has been submitted', () => {
    const { bloc } = harness();

    const event = keyEvent('Enter');
    bloc.handleKeyDown(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(event.stopPropagation).not.toHaveBeenCalled();
  });

  it('keeps swallowing Enter after the request succeeded', async () => {
    // The lock is what stops an impatient second Enter sending a second email.
    silenceLogs();
    const { bloc } = harness();
    fill(bloc, 'jamesat', 'james@gmail.com');
    await bloc.submit();

    const event = keyEvent('Enter');
    bloc.handleKeyDown(event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });

  it('stops swallowing it once a failure has unlocked the form', async () => {
    silenceLogs();
    const { bloc } = harness(async () => {
      throw new Error('nope');
    });
    fill(bloc, 'jamesat', 'james@gmail.com');
    await bloc.submit();

    const event = keyEvent('Enter');
    bloc.handleKeyDown(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});

describe('when the link is on its way', () => {
  it('turns the screen into a confirmation rather than navigating away', async () => {
    silenceLogs();
    const { bloc } = harness();
    fill(bloc, 'jamesat', 'james@gmail.com');

    await bloc.submit();

    // There is no navigate port on this bloc: success is `submitted`, and the
    // view swaps the form for the "check your email" copy in place.
    expect(bloc.submitted).toBe(true);
    expect(bloc.errorMessage).toBe('');
  });

  it('keeps what was typed, so the confirmation can name the address', async () => {
    silenceLogs();
    const { bloc } = harness();
    fill(bloc, 'jamesat', 'james@gmail.com');

    await bloc.submit();

    expect(bloc.email).toBe('james@gmail.com');
  });
});

describe('when it does not go out', () => {
  it('treats a false result as a failure, not as a send', async () => {
    // The port resolves with a boolean; "did not throw" is not success here.
    const { bloc } = harness(async () => false);
    fill(bloc, 'jamesat', 'james@gmail.com');

    await bloc.submit();

    expect(bloc.submitted).toBe(false);
    expect(bloc.errorMessage).toBe('Failed to send password reset email. Please try again.');
    expect(bloc.isDisabled).toBe(false);
  });

  it('unlocks the form after a false result so it can be tried again', async () => {
    silenceLogs();
    let ok = false;
    const request = vi.fn(async () => ok);
    const { bloc } = harness(request);
    fill(bloc, 'jamesat', 'james@gmail.com');

    await bloc.submit();
    ok = true;
    await bloc.submit();

    expect(request).toHaveBeenCalledTimes(2);
    expect(bloc.submitted).toBe(true);
  });

  it('shows the gateway’s own message when a throw carries one', async () => {
    silenceLogs();
    const { bloc } = harness(async () => {
      throw new Error('Account is locked');
    });
    fill(bloc, 'jamesat', 'james@gmail.com');

    await bloc.submit();

    expect(bloc.errorMessage).toBe('Account is locked');
    expect(bloc.submitted).toBe(false);
  });

  it('falls back to its own copy for a throw with an empty message', async () => {
    silenceLogs();
    const { bloc } = harness(async () => {
      throw new Error('');
    });
    fill(bloc, 'jamesat', 'james@gmail.com');

    await bloc.submit();

    expect(bloc.errorMessage).toBe('Failed to send password reset email. Please try again.');
  });

  it('survives a rejection that is not an Error at all', async () => {
    silenceLogs();
    const { bloc } = harness(async () => {
      throw 'boom';
    });
    fill(bloc, 'jamesat', 'james@gmail.com');

    await expect(bloc.submit()).resolves.toBeUndefined();
    expect(bloc.errorMessage).toBe('Failed to send password reset email. Please try again.');
    expect(bloc.isDisabled).toBe(false);
  });

  it('survives a rejection with no value at all', async () => {
    silenceLogs();
    const { bloc } = harness(async () => {
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw null;
    });
    fill(bloc, 'jamesat', 'james@gmail.com');

    await expect(bloc.submit()).resolves.toBeUndefined();
    expect(bloc.errorMessage).toBe('Failed to send password reset email. Please try again.');
  });

  it('survives a port that resolves with nothing', async () => {
    const { bloc } = harness(async () => undefined as unknown as boolean);
    fill(bloc, 'jamesat', 'james@gmail.com');

    await bloc.submit();

    expect(bloc.submitted).toBe(false);
    expect(bloc.errorMessage).toBe('Failed to send password reset email. Please try again.');
  });
});
