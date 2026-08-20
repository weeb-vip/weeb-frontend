import { writable } from 'svelte/store';
import { AuthStorage } from '../../utils/auth-storage';
import { identifyUser } from '../../utils/analytics';

interface LoggedInState {
  isLoggedIn: boolean;
  isAuthInitialized: boolean;
}

interface LoginModalState {
  isOpen: boolean;
  register: boolean;
  /**
   * Why the modal opened, in the visitor's terms ("Sign in to track Chiikawa").
   * Replaces the generic subtitle so the prompt explains itself instead of
   * appearing as an unexplained wall in front of the thing they just clicked.
   */
  reason: string | null;
}

// Create writable stores
function createLoggedInStore() {
  const { subscribe, set, update } = writable<LoggedInState>({
    isLoggedIn: false,
    isAuthInitialized: false
  });

  return {
    subscribe,
    setLoggedIn: (userData?: { id: string; username?: string; email?: string }) => {
      console.log('🔍 setLoggedIn called with userData:', userData);
      update(state => ({ ...state, isLoggedIn: true, isAuthInitialized: true }));

      // Identify user in PostHog for analytics
      if (userData?.id) {
        console.log('📊 About to identify user in PostHog:', userData);
        identifyUser(userData.id, {});
      } else {
        console.warn('⚠️ setLoggedIn called without user data - skipping PostHog identification');
      }
    },
    logout: () => {
      update(state => ({ ...state, isLoggedIn: false, isAuthInitialized: true }));

      // Clear any client-accessible cookies (non-HttpOnly ones)
      if (typeof document !== 'undefined') {
        const cookiesToClear = ['authToken', 'refreshToken', 'session', 'user'];
        cookiesToClear.forEach(cookieName => {
          document.cookie = `${cookieName}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        });
      }

      // Reset PostHog session when user logs out
      if (typeof window !== 'undefined' && window.posthog) {
        try {
          window.posthog.reset();
          console.log('📊 PostHog session reset on logout');
        } catch (error) {
          console.warn('📊 PostHog reset failed:', error);
        }
      }
    },
    setAuthInitialized: () => update(state => ({ ...state, isAuthInitialized: true })),
    // Check current cookie-based login status
    checkCookieStatus: () => {
      const isLoggedInFromCookies = AuthStorage.isLoggedIn();
      update(state => ({
        ...state,
        isLoggedIn: isLoggedInFromCookies,
        isAuthInitialized: true
      }));
      return isLoggedInFromCookies;
    },
    set,
    update
  };
}

/**
 * The action a signed-out visitor was trying to take. Held outside the store
 * because it is a closure, not state anything renders, and it must survive the
 * whole modal round-trip. Exactly one intent is pending at a time: a second
 * gated click replaces the first rather than queueing.
 */
let pendingIntent: (() => void) | null = null;

function createLoginModalStore() {
  const { subscribe, set, update } = writable<LoginModalState>({
    isOpen: false,
    register: false,
    reason: null
  });

  const clear = () => { pendingIntent = null; };

  return {
    subscribe,
    openLogin: () => { clear(); set({ isOpen: true, register: false, reason: null }); },
    openRegister: () => { clear(); set({ isOpen: true, register: true, reason: null }); },
    /**
     * Gate an action behind sign-in without losing it. The visitor lands back on
     * the same page with the thing they asked for already done -- they do not
     * have to find the show again and click the button a second time.
     */
    requireAuth: (options: { reason?: string; register?: boolean; onAuthed?: () => void }) => {
      pendingIntent = options.onAuthed ?? null;
      set({
        isOpen: true,
        register: options.register ?? false,
        reason: options.reason ?? null
      });
    },
    // Dismissing is a decision. Drop the intent rather than firing it later from
    // somewhere the visitor cannot connect to what they did.
    close: () => { clear(); set({ isOpen: false, register: false, reason: null }); },
    set,
    update
  };
}

export const loggedInStore = createLoggedInStore();
export const loginModalStore = createLoginModalStore();

// Replay the preserved intent once authentication actually lands, whichever
// route got there -- modal login, registration, or a cookie check that resolved
// mid-flight. Deferred a tick so the auth token is in place before the mutation
// goes out, which is the difference between completing the action and failing
// it a second time.
let wasLoggedIn = false;
loggedInStore.subscribe(state => {
  const justAuthed = state.isLoggedIn && !wasLoggedIn;
  wasLoggedIn = state.isLoggedIn;
  if (!justAuthed || !pendingIntent) return;

  const run = pendingIntent;
  pendingIntent = null;
  setTimeout(run, 0);
});
