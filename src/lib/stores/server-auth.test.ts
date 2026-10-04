import { describe, it, expect } from 'vitest';
import { resolveLoggedIn, serverAuthFromContext } from './server-auth';

describe('resolveLoggedIn', () => {
  it('believes the server until the client store has resolved', () => {
    expect(resolveLoggedIn({ isLoggedIn: false, isAuthInitialized: false }, { isLoggedIn: true })).toBe(true);
    expect(resolveLoggedIn({ isLoggedIn: false, isAuthInitialized: false }, { isLoggedIn: false })).toBe(false);
  });

  it('lets the client store win once it has resolved', () => {
    expect(resolveLoggedIn({ isLoggedIn: false, isAuthInitialized: true }, { isLoggedIn: true })).toBe(false);
    expect(resolveLoggedIn({ isLoggedIn: true, isAuthInitialized: true }, { isLoggedIn: false })).toBe(true);
  });

  it('falls back to the store when the server said nothing', () => {
    expect(resolveLoggedIn({ isLoggedIn: false, isAuthInitialized: false }, null)).toBe(false);
    expect(resolveLoggedIn({ isLoggedIn: true, isAuthInitialized: false }, undefined)).toBe(true);
  });

  it('treats a store without the flag as resolved, so plain stubs behave as before', () => {
    expect(resolveLoggedIn({ isLoggedIn: false }, { isLoggedIn: true })).toBe(false);
  });
});

describe('serverAuthFromContext', () => {
  it('is null outside a component tree rather than throwing', () => {
    expect(serverAuthFromContext()).toBeNull();
  });
});
