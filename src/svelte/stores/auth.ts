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

function createLoginModalStore() {
  const { subscribe, set, update } = writable<LoginModalState>({
    isOpen: false,
    register: false
  });

  return {
    subscribe,
    openLogin: () => set({ isOpen: true, register: false }),
    openRegister: () => set({ isOpen: true, register: true }),
    close: () => set({ isOpen: false, register: false }),
    set,
    update
  };
}

export const loggedInStore = createLoggedInStore();
export const loginModalStore = createLoginModalStore();
