import { writable } from 'svelte/store';
import { AuthStorage } from '../../utils/auth-storage';

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
    setLoggedIn: () => update(state => ({ ...state, isLoggedIn: true, isAuthInitialized: true })),
    logout: () => update(state => ({ ...state, isLoggedIn: false, isAuthInitialized: true })),
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