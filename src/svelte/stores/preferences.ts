import { writable } from 'svelte/store';
import debug from '../../utils/debug';

export type TitleLanguage = 'english' | 'japanese';

interface PreferencesState {
  titleLanguage: TitleLanguage;
}

const defaultPreferences: PreferencesState = {
  titleLanguage: 'english'
};

function createPreferencesStore() {
  const { subscribe, set, update } = writable<PreferencesState>(defaultPreferences);

  // Load preferences from localStorage on initialization
  function loadPreferences() {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem('anime-preferences');
        if (saved) {
          const parsed = JSON.parse(saved);
          debug.info('Loaded preferences from localStorage:', parsed);
          set({ ...defaultPreferences, ...parsed });
        }
      } catch (error) {
        debug.error('Failed to load preferences from localStorage:', error);
      }
    }
  }

  // Save preferences to localStorage
  function savePreferences(preferences: PreferencesState) {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('anime-preferences', JSON.stringify(preferences));
        debug.info('Saved preferences to localStorage:', preferences);
      } catch (error) {
        debug.error('Failed to save preferences to localStorage:', error);
      }
    }
  }

  return {
    subscribe,

    // Initialize preferences (call this on app startup)
    init: () => {
      loadPreferences();
    },

    // Toggle between English and Japanese titles
    toggleTitleLanguage: () => {
      update(prefs => {
        const newPrefs = {
          ...prefs,
          titleLanguage: prefs.titleLanguage === 'english' ? 'japanese' : 'english'
        };
        savePreferences(newPrefs);
        debug.info('Title language toggled to:', newPrefs.titleLanguage);
        return newPrefs;
      });
    },

    // Set specific title language
    setTitleLanguage: (language: TitleLanguage) => {
      update(prefs => {
        const newPrefs = { ...prefs, titleLanguage: language };
        savePreferences(newPrefs);
        debug.info('Title language set to:', language);
        return newPrefs;
      });
    },

    // Reset to defaults
    reset: () => {
      set(defaultPreferences);
      savePreferences(defaultPreferences);
      debug.info('Preferences reset to defaults');
    }
  };
}

export const preferencesStore = createPreferencesStore();

// Helper function to get the appropriate title based on preference
export function getAnimeTitle(anime: any, titleLanguage: TitleLanguage): string {
  if (!anime) return 'Unknown';

  if (titleLanguage === 'japanese') {
    return anime.titleJp || anime.titleEn || 'Unknown';
  } else {
    return anime.titleEn || anime.titleJp || 'Unknown';
  }
}