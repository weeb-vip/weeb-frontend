import { writable } from 'svelte/store';

interface DarkModeState {
  isDarkMode: boolean;
}

// Dark mode utilities
const updateThemeColor = (isDark: boolean) => {
  if (typeof window !== 'undefined') {
    // Update theme-color meta tag for PWA status bar
    const existingTag = document.querySelector('meta[name="theme-color"]:not([media])');
    if (existingTag) {
      existingTag.setAttribute('content', isDark ? '#111827' : '#ffffff');
    } else {
      // Create the meta tag if it doesn't exist
      const metaTag = document.createElement('meta');
      metaTag.name = 'theme-color';
      metaTag.content = isDark ? '#111827' : '#ffffff';
      document.head.appendChild(metaTag);
    }
  }
};

const getInitialTheme = (): boolean => {
  if (typeof window === 'undefined') return false;

  const savedTheme = localStorage.getItem('darkMode');
  if (savedTheme !== null) {
    return savedTheme === 'true';
  }

  // If no saved preference, use system preference
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

function createDarkModeStore() {
  const { subscribe, set, update } = writable<DarkModeState>({
    isDarkMode: getInitialTheme()
  });

  // The current value, so `toggleDarkMode` can read it without re-entering
  // `update` (its helpers call `set`, which inside an updater is a trap).
  let current = getInitialTheme();
  subscribe((state) => {
    current = state.isDarkMode;
  });

  // The list is kept alongside the handler, not looked up again on the way
  // out: `matchMedia` hands back a fresh MediaQueryList per call in a real
  // browser, and removing a listener from a different object removes nothing.
  let mediaQueryList: MediaQueryList | null = null;
  let mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null;

  /** Store value, the `dark` class and the theme-color tag, always together. */
  const applyTheme = (isDark: boolean) => {
    set({ isDarkMode: isDark });
    if (typeof window === 'undefined') return;
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    updateThemeColor(isDark);
  };

  /**
   * Detaches the OS listener, if one is attached. Every explicit choice goes
   * through here: a listener left behind would keep rewriting the class after
   * the user has picked a theme, so a later OS change would silently override
   * them.
   */
  const stopFollowingSystem = () => {
    if (mediaQueryList && mediaQueryListener) {
      mediaQueryList.removeEventListener('change', mediaQueryListener);
    }
    mediaQueryList = null;
    mediaQueryListener = null;
  };

  /** Replaces any current listener, so repeated calls cannot stack handlers. */
  const followSystem = () => {
    if (typeof window === 'undefined') return;
    stopFollowingSystem();
    mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQueryListener = (e: MediaQueryListEvent) => applyTheme(e.matches);
    mediaQueryList.addEventListener('change', mediaQueryListener);
  };

  const choose = (dark: boolean) => {
    // An explicit pick outranks the OS, and stays outranking it.
    stopFollowingSystem();
    applyTheme(dark);
    if (typeof window !== 'undefined') {
      localStorage.setItem('darkMode', dark.toString());
    }
  };

  return {
    subscribe,
    initializeTheme: () => {
      if (typeof window !== 'undefined') {
        const initialTheme = getInitialTheme();
        applyTheme(initialTheme);

        // Listen for system theme changes if no saved preference
        const savedTheme = localStorage.getItem('darkMode');
        if (savedTheme === null) {
          followSystem();
        } else {
          stopFollowingSystem();
        }
      }
    },
    toggleDarkMode: () => {
      choose(!current);
    },
    setDarkMode: (dark: boolean) => {
      choose(dark);
    },
    useSystemTheme: () => {
      if (typeof window !== 'undefined') {
        // Clear saved preference to use system theme
        localStorage.removeItem('darkMode');

        applyTheme(window.matchMedia('(prefers-color-scheme: dark)').matches);
        followSystem();
      }
    },
    /** Teardown for anything that outlives the document, e.g. a test. */
    dispose: () => {
      stopFollowingSystem();
    },
    set,
    update
  };
}

export const darkModeStore = createDarkModeStore();