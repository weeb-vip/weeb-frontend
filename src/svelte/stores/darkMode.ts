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

  let mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null;

  return {
    subscribe,
    initializeTheme: () => {
      if (typeof window !== 'undefined') {
        const initialTheme = getInitialTheme();
        set({ isDarkMode: initialTheme });

        if (initialTheme) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        updateThemeColor(initialTheme);

        // Listen for system theme changes if no saved preference
        const savedTheme = localStorage.getItem('darkMode');
        if (savedTheme === null) {
          const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
          mediaQueryListener = (e: MediaQueryListEvent) => {
            const systemDark = e.matches;
            set({ isDarkMode: systemDark });
            if (systemDark) {
              document.documentElement.classList.add('dark');
            } else {
              document.documentElement.classList.remove('dark');
            }
            updateThemeColor(systemDark);
          };
          mediaQuery.addEventListener('change', mediaQueryListener);
        }
      }
    },
    toggleDarkMode: () => {
      update(state => {
        const newDarkMode = !state.isDarkMode;
        if (typeof window !== 'undefined') {
          localStorage.setItem('darkMode', newDarkMode.toString());
          if (newDarkMode) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
          updateThemeColor(newDarkMode);
        }
        return { isDarkMode: newDarkMode };
      });
    },
    setDarkMode: (dark: boolean) => {
      set({ isDarkMode: dark });
      if (typeof window !== 'undefined') {
        localStorage.setItem('darkMode', dark.toString());
        if (dark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        updateThemeColor(dark);
      }
    },
    useSystemTheme: () => {
      if (typeof window !== 'undefined') {
        // Clear saved preference to use system theme
        localStorage.removeItem('darkMode');

        // Get current system preference
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        set({ isDarkMode: systemDark });

        if (systemDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        updateThemeColor(systemDark);

        // Set up listener for system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = (e: MediaQueryListEvent) => {
          const newSystemDark = e.matches;
          set({ isDarkMode: newSystemDark });
          if (newSystemDark) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
          updateThemeColor(newSystemDark);
        };

        // Remove any existing listener first
        if (mediaQueryListener) {
          mediaQuery.removeEventListener('change', mediaQueryListener);
        }
        mediaQueryListener = handleChange;
        mediaQuery.addEventListener('change', handleChange);
      }
    },
    set,
    update
  };
}

export const darkModeStore = createDarkModeStore();