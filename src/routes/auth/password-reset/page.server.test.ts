import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The password-reset page is the one place in the app where a user hands over a
 * new secret, so the rules worth pinning are the ones that would silently let a
 * bad reset through, or tell the user the wrong thing about why it failed:
 *
 *  - the token and the email come from the URL, never from the posted form, so
 *    a crafted form body cannot redirect the reset at another account,
 *  - the validation ladder runs in a fixed order and the mutation is not
 *    reached until every rung passes,
 *  - `username` on the wire carries the EMAIL, which is the sort of mapping
 *    that reads like a bug and gets "fixed" into a real one,
 *  - a falsy answer from the gateway is a failure, not a success.
 *
 * `$lib/services/query-options` is mocked at the module seam, so `mutationFn`
 * is a spy and nothing is ever sent.
 */

const mutationFn = vi.fn<(input: unknown) => Promise<unknown>>();
const resetPasswordFactory = vi.fn(() => ({ mutationFn }));

vi.mock('$lib/services/query-options', () => ({
  resetPassword: () => resetPasswordFactory()
}));

const { load, actions } = await import('./+page.server');

/**
 * `PageServerLoad` is typed as possibly returning void, so every success path
 * goes through this: it calls the real loader and narrows the payload.
 */
const run = async (event: Parameters<typeof load>[0]): Promise<Record<string, any>> =>
  (await load(event)) as Record<string, any>;

/** The same narrowing for the default action's return. */
const submit = async (
  event: Parameters<typeof actions.default>[0]
): Promise<Record<string, any>> => (await actions.default(event)) as Record<string, any>;

/** The loader only ever reads the query string. */
function loadArgs(search: string) {
  return { url: new URL(`https://weeb.vip/auth/password-reset${search}`) } as never;
}

/** A real POST with a real FormData body, as SvelteKit would hand the action. */
function postArgs(search: string, fields: Record<string, string>) {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.append(key, value);
  return {
    url: new URL(`https://weeb.vip/auth/password-reset${search}`),
    request: new Request('https://weeb.vip/auth/password-reset', { method: 'POST', body })
  } as never;
}

const VALID = '?token=tok-123&email=someone%40example.com';

beforeEach(() => {
  mutationFn.mockReset();
  mutationFn.mockResolvedValue(true);
  resetPasswordFactory.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('load: what the page renders before anything is typed', () => {
  it('shows the form and echoes both values back when the link is complete', async () => {
    const result = await run(loadArgs(VALID));

    expect(result).toEqual({
      token: 'tok-123',
      email: 'someone@example.com',
      errorMessage: '',
      showForm: true
    });
  });

  it('hides the form with the token message when the token is missing', async () => {
    const result = await run(loadArgs('?email=someone@example.com'));

    expect(result.showForm).toBe(false);
    expect(result.errorMessage).toBe(
      'Invalid or missing reset token. Please request a new password reset.'
    );
  });

  it('hides the form with its OWN message when only the email is missing', async () => {
    // A distinct sentence, because "ask for a new reset" is the fix for one and
    // not the other -- a reader who sees the token message for a missing email
    // will keep requesting links that arrive just as broken.
    const result = await run(loadArgs('?token=tok-123'));

    expect(result.showForm).toBe(false);
    expect(result.errorMessage).toBe(
      'Invalid or missing email. Please request a new password reset.'
    );
  });

  it('reports the missing token first when BOTH are missing', async () => {
    expect((await run(loadArgs(''))).errorMessage).toBe(
      'Invalid or missing reset token. Please request a new password reset.'
    );
  });

  it('treats an empty token as missing rather than as a token', async () => {
    const result = await run(loadArgs('?token=&email=someone@example.com'));

    expect(result.showForm).toBe(false);
    expect(result.token).toBe('');
  });

  it('treats an empty email as missing', async () => {
    const result = await run(loadArgs('?token=tok-123&email='));

    expect(result.showForm).toBe(false);
    expect(result.errorMessage).toBe(
      'Invalid or missing email. Please request a new password reset.'
    );
  });

  it('returns null, not undefined, for an absent parameter', async () => {
    const result = await run(loadArgs(''));

    expect(result.token).toBeNull();
    expect(result.email).toBeNull();
  });
});

describe('the action reads the credentials from the URL, not the form', () => {
  it('refuses when the URL carries no token, whatever the form says', async () => {
    const result = await submit(
      postArgs('?email=someone@example.com', {
        token: 'smuggled-in-the-body',
        newPassword: 'abcdefgh',
        confirmPassword: 'abcdefgh'
      })
    );

    expect(result).toEqual({
      errorMessage: 'Invalid or missing reset token. Please request a new password reset.',
      successMessage: ''
    });
    expect(mutationFn).not.toHaveBeenCalled();
  });

  it('refuses when the URL carries no email, whatever the form says', async () => {
    const result = await submit(
      postArgs('?token=tok-123', {
        email: 'attacker@example.com',
        newPassword: 'abcdefgh',
        confirmPassword: 'abcdefgh'
      })
    );

    expect(result.errorMessage).toBe(
      'Invalid or missing reset token. Please request a new password reset.'
    );
    expect(mutationFn).not.toHaveBeenCalled();
  });

  it('does not even read the form body when the URL is incomplete', async () => {
    // The guard runs before `request.formData()`, so a malformed body cannot
    // turn a missing-token refusal into a 500.
    const result = await submit({
      url: new URL('https://weeb.vip/auth/password-reset'),
      request: new Request('https://weeb.vip/auth/password-reset', {
        method: 'POST',
        body: 'not-form-data',
        headers: { 'content-type': 'application/json' }
      })
    } as never);

    expect(result.errorMessage).toBe(
      'Invalid or missing reset token. Please request a new password reset.'
    );
  });
});

describe('the validation ladder, in order', () => {
  it('asks for both fields when the new password is empty', async () => {
    const result = await submit(postArgs(VALID, { confirmPassword: 'abcdefgh' }));

    expect(result).toEqual({
      errorMessage: 'Both password fields are required.',
      successMessage: ''
    });
    expect(mutationFn).not.toHaveBeenCalled();
  });

  it('asks for both fields when the confirmation is empty', async () => {
    const result = await submit(postArgs(VALID, { newPassword: 'abcdefgh' }));

    expect(result.errorMessage).toBe(
      'Both password fields are required.'
    );
    expect(mutationFn).not.toHaveBeenCalled();
  });

  it('asks for both fields when they are present but blank', async () => {
    const result = await submit(
      postArgs(VALID, { newPassword: '', confirmPassword: '' })
    );

    expect(result.errorMessage).toBe(
      'Both password fields are required.'
    );
    expect(mutationFn).not.toHaveBeenCalled();
  });

  it('rejects seven characters as too short', async () => {
    const result = await submit(
      postArgs(VALID, { newPassword: 'abcdefg', confirmPassword: 'abcdefg' })
    );

    expect(result.errorMessage).toBe(
      'Password must be at least 8 characters long.'
    );
    expect(mutationFn).not.toHaveBeenCalled();
  });

  it('accepts exactly eight characters -- the boundary is inclusive', async () => {
    const result = await submit(
      postArgs(VALID, { newPassword: 'abcdefgh', confirmPassword: 'abcdefgh' })
    );

    expect(result.successMessage).toBe(
      'Password reset successful! Redirecting to home page...'
    );
    expect(mutationFn).toHaveBeenCalledTimes(1);
  });

  it('reports "too short" rather than "do not match" when both are wrong', async () => {
    // Length is checked before equality, so a short password that also differs
    // from its confirmation is reported as short. Fixing the mismatch first
    // would leave the reader stuck.
    const result = await submit(
      postArgs(VALID, { newPassword: 'short', confirmPassword: 'different' })
    );

    expect(result.errorMessage).toBe(
      'Password must be at least 8 characters long.'
    );
    expect(mutationFn).not.toHaveBeenCalled();
  });

  it('rejects a mismatch once both are long enough', async () => {
    const result = await submit(
      postArgs(VALID, { newPassword: 'abcdefgh', confirmPassword: 'abcdefghi' })
    );

    expect(result).toEqual({ errorMessage: 'Passwords do not match.', successMessage: '' });
    expect(mutationFn).not.toHaveBeenCalled();
  });

  it('measures only the new password, so a short confirmation is a mismatch', async () => {
    // The length rung reads `newPassword` alone; a short confirmation therefore
    // falls through to the equality rung rather than the length one.
    const result = await submit(
      postArgs(VALID, { newPassword: 'abcdefgh', confirmPassword: 'abc' })
    );

    expect(result.errorMessage).toBe('Passwords do not match.');
  });

  it('is case sensitive about the confirmation', async () => {
    const result = await submit(
      postArgs(VALID, { newPassword: 'abcdefgh', confirmPassword: 'ABCDEFGH' })
    );

    expect(result.errorMessage).toBe('Passwords do not match.');
  });

  it('counts characters, not bytes, at the boundary', async () => {
    const eight = 'aaaaaaaé'; // eight characters, nine UTF-8 bytes
    const result = await submit(
      postArgs(VALID, { newPassword: eight, confirmPassword: eight })
    );

    expect(result.successMessage).not.toBe('');
    expect(mutationFn).toHaveBeenCalledTimes(1);
  });

  it('returns a plain object rather than an ActionFailure for every rejection', async () => {
    // Worth pinning: these are 200 responses carrying `errorMessage`, not
    // `fail(400)`, so the page reads them off `form` with no status branch.
    const result = await submit(
      postArgs(VALID, { newPassword: 'abcdefg', confirmPassword: 'abcdefg' })
    );

    expect(Object.keys(result).sort()).toEqual(['errorMessage', 'successMessage']);
    expect(result).not.toHaveProperty('status');
  });
});

describe('what reaches the mutation', () => {
  it('sends the token from the URL and the EMAIL as `username`', async () => {
    await submit(
      postArgs(VALID, { newPassword: 'hunter22!', confirmPassword: 'hunter22!' })
    );

    expect(mutationFn).toHaveBeenCalledWith({
      input: {
        token: 'tok-123',
        newPassword: 'hunter22!',
        username: 'someone@example.com'
      }
    });
  });

  it('sends the decoded email, not the percent-encoded query value', async () => {
    await submit(
      postArgs('?token=t&email=a%2Bb%40example.com', {
        newPassword: 'hunter22!',
        confirmPassword: 'hunter22!'
      })
    );

    const [payload] = mutationFn.mock.calls[0] as [{ input: { username: string } }];
    expect(payload.input.username).toBe('a+b@example.com');
  });

  it('builds the mutation port once per submission', async () => {
    await submit(
      postArgs(VALID, { newPassword: 'abcdefgh', confirmPassword: 'abcdefgh' })
    );

    expect(resetPasswordFactory).toHaveBeenCalledTimes(1);
  });
});

describe('what comes back from the mutation', () => {
  it('reports success for a truthy result', async () => {
    mutationFn.mockResolvedValue(true);

    expect(
      await submit(
        postArgs(VALID, { newPassword: 'abcdefgh', confirmPassword: 'abcdefgh' })
      )
    ).toEqual({
      errorMessage: '',
      successMessage: 'Password reset successful! Redirecting to home page...'
    });
  });

  it.each([false, null, undefined, 0, ''])(
    'treats the falsy result %o as a failure, not a silent success',
    async (value) => {
      // The gateway answers `ResetPassword: false` for a spent or wrong token.
      // Rendering that as success is the worst outcome on this page: the reader
      // walks away believing a password they cannot log in with.
      mutationFn.mockResolvedValue(value);

      const result = await submit(
        postArgs(VALID, { newPassword: 'abcdefgh', confirmPassword: 'abcdefgh' })
      );

      expect(result).toEqual({
        errorMessage: 'Password reset failed. Please try again.',
        successMessage: ''
      });
    }
  );

  it('surfaces the thrown error message so the reader learns why', async () => {
    mutationFn.mockRejectedValue(new Error('Reset token has expired'));

    const result = await submit(
      postArgs(VALID, { newPassword: 'abcdefgh', confirmPassword: 'abcdefgh' })
    );

    expect(result).toEqual({
      errorMessage: 'Reset token has expired',
      successMessage: ''
    });
  });

  it('falls back to the generic sentence when the thrown value carries no message', async () => {
    mutationFn.mockRejectedValue({ code: 'ECONNRESET' });

    expect(
      await submit(
        postArgs(VALID, { newPassword: 'abcdefgh', confirmPassword: 'abcdefgh' })
      )
    ).toEqual({
      errorMessage: 'Password reset failed. Please try again.',
      successMessage: ''
    });
  });

  it('falls back for an error whose message is the empty string', async () => {
    mutationFn.mockRejectedValue(new Error(''));

    const result = await submit(
      postArgs(VALID, { newPassword: 'abcdefgh', confirmPassword: 'abcdefgh' })
    );

    expect(result.errorMessage).toBe('Password reset failed. Please try again.');
  });

  it('never leaks the submitted password back into the response', async () => {
    mutationFn.mockRejectedValue(new Error('boom'));

    const result = await submit(
      postArgs(VALID, { newPassword: 'sup3rsecret', confirmPassword: 'sup3rsecret' })
    );

    expect(JSON.stringify(result)).not.toContain('sup3rsecret');
  });

  it('logs the failure for the server operator', async () => {
    const spy = vi.spyOn(console, 'error');
    mutationFn.mockRejectedValue(new Error('boom'));

    await submit(
      postArgs(VALID, { newPassword: 'abcdefgh', confirmPassword: 'abcdefgh' })
    );

    expect(spy).toHaveBeenCalled();
  });
});
