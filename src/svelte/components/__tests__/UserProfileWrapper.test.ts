import { describe, it, expect } from '@jest/globals';

/**
 * The rule under test lives in `UserProfileWrapper.bloc.svelte.ts` as the
 * exported pure function `fallbackUserFor`. That module is a runes module, so
 * ts-jest cannot load it; the function is small and total, and is mirrored
 * here verbatim. Change one and change the other.
 */
type ProfileUser = { username: string; profileImageUrl: string | null };

function fallbackUserFor(isLoggedIn: boolean, hasError: boolean): ProfileUser | null {
  if (!isLoggedIn || !hasError) return null;
  return { username: 'User', profileImageUrl: null };
}

/** `displayUser` in the bloc: real data wins, the fallback covers a failure. */
function displayUserFor(
  user: ProfileUser | null | undefined,
  isLoggedIn: boolean,
  hasError: boolean,
): ProfileUser | null {
  return user || fallbackUserFor(isLoggedIn, hasError);
}

/** The four states the view switches on. */
function statusFor(isLoggedIn: boolean, isLoading: boolean, displayUser: ProfileUser | null) {
  if (!isLoggedIn) return 'signed-out';
  if (isLoading) return 'loading';
  return displayUser ? 'ready' : 'stuck';
}

describe('UserProfileWrapper logic', () => {
  describe('fallback user', () => {
    it('stands in for a failed user query while logged in', () => {
      expect(fallbackUserFor(true, true)).toEqual({ username: 'User', profileImageUrl: null });
    });

    it('covers ANY failure, not only "Access denied"', () => {
      // The old rule matched on the error message, so a network error or a 500
      // produced no user at all and the header pulsed forever.
      expect(fallbackUserFor(true, true)).not.toBeNull();
    });

    it('is not used when nobody is logged in', () => {
      expect(fallbackUserFor(false, true)).toBeNull();
    });

    it('is not used when the query succeeded', () => {
      expect(fallbackUserFor(true, false)).toBeNull();
    });
  });

  describe('display user', () => {
    it('prefers real user data over the fallback', () => {
      const realUser = { username: 'realuser', profileImageUrl: 'real.jpg' };

      expect(displayUserFor(realUser, true, true)).toEqual(realUser);
    });

    it('falls back when the query returned nothing and failed', () => {
      expect(displayUserFor(null, true, true)).toEqual({ username: 'User', profileImageUrl: null });
    });

    it('is null when the query returned nothing and did not fail', () => {
      expect(displayUserFor(undefined, true, false)).toBeNull();
    });
  });

  describe('status', () => {
    it('is signed-out before anything is loaded', () => {
      expect(statusFor(false, false, null)).toBe('signed-out');
    });

    it('is loading only while logged in', () => {
      expect(statusFor(true, true, null)).toBe('loading');
    });

    it('is ready once there is someone to render', () => {
      expect(statusFor(true, false, { username: 'User', profileImageUrl: null })).toBe('ready');
    });

    it('is stuck when the query settled with no user at all', () => {
      // The state that must NOT pulse: nothing is going to resolve it.
      expect(statusFor(true, false, null)).toBe('stuck');
    });
  });
});
