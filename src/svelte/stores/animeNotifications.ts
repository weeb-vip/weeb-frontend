import { writable, derived, type Readable } from 'svelte/store';
import { animeNotificationService, type AnimeForNotification } from '../../services/animeNotifications';
import debug from '../../utils/debug';

// Types matching the React store structure
interface AnimeTimingData {
  countdown: string;
  isAiring: boolean;
  hasAired: boolean;
  progress?: number;
  isAiringToday: boolean;
  isCurrentlyAiring: boolean;
  hasAlreadyAired: boolean;
  airDateTime: string;
  episode?: {
    episodeNumber?: number | null;
    titleEn?: string | null;
    titleJp?: string | null;
    airDate?: string | null;
  };
}

interface NotificationStore {
  timingData: Record<string, AnimeTimingData>;
  countdowns: Record<string, Pick<AnimeTimingData, 'countdown' | 'isAiring' | 'hasAired' | 'progress'>>;
  isReady: boolean;
}

// Create the main store
function createAnimeNotificationStore() {
  const { subscribe, set, update } = writable<NotificationStore>({
    timingData: {},
    countdowns: {},
    isReady: false
  });

  let isInitialized = false;

  // Initialize the service and set up callbacks
  function initialize() {
    if (isInitialized) return;
    isInitialized = true;

    debug.info('🔔 Svelte: Initializing anime notification store');

    // Set up timing callback to receive comprehensive worker data
    animeNotificationService.setTimingCallback((animeId, timingData) => {
      update(store => ({
        ...store,
        timingData: {
          ...store.timingData,
          [animeId]: timingData
        }
      }));
    });

    // Set up countdown callback to receive worker data (backward compatibility)
    animeNotificationService.setCountdownCallback((animeId, countdown, isAiring, hasAired, progress) => {
      update(store => {
        const newCountdowns = {
          ...store.countdowns,
          [animeId]: { countdown, isAiring, hasAired, progress }
        };

        // Also update or create timing data
        const currentTiming = store.timingData[animeId];
        const updatedTiming: AnimeTimingData = {
          ...currentTiming,
          countdown,
          isAiring,
          hasAired,
          progress,
          // Use current values, not OR logic that prevents state transitions
          isAiringToday: currentTiming?.isAiringToday || false,
          isCurrentlyAiring: isAiring, // Use fresh value from worker
          hasAlreadyAired: hasAired,   // Use fresh value from worker
          airDateTime: currentTiming?.airDateTime || '',
        };

        const newTimingData = {
          ...store.timingData,
          [animeId]: updatedTiming
        };

        return {
          ...store,
          timingData: newTimingData,
          countdowns: newCountdowns,
          isReady: animeNotificationService.isReady()
        };
      });
    });

    // Mark as ready when service is initialized
    update(store => ({
      ...store,
      isReady: animeNotificationService.isReady()
    }));
  }

  return {
    subscribe,

    // Initialize the store (should be called once on app start)
    initialize,

    // Set timing data (for compatibility with existing worker messages)
    setTimingData: (animeId: string, data: AnimeTimingData) => {
      update(store => {
        const newTimingData = { ...store.timingData, [animeId]: data };
        const newCountdowns = {
          ...store.countdowns,
          [animeId]: {
            countdown: data.countdown,
            isAiring: data.isAiring,
            hasAired: data.hasAired,
            progress: data.progress,
          },
        };
        return {
          ...store,
          timingData: newTimingData,
          countdowns: newCountdowns
        };
      });
    },

    // Get timing data for a specific anime
    getTimingData: (animeId: string): Readable<AnimeTimingData | undefined> => {
      return derived([{ subscribe }], ([$store]) => $store.timingData[animeId]);
    },

    // Get countdown data for a specific anime
    getCountdown: (animeId: string): Readable<Pick<AnimeTimingData, 'countdown' | 'isAiring' | 'hasAired' | 'progress'> | undefined> => {
      return derived([{ subscribe }], ([$store]) => $store.countdowns[animeId]);
    },

    // Clear all data
    clearAll: () => {
      debug.info('🔔 Svelte: Clearing all timing data');
      set({
        timingData: {},
        countdowns: {},
        isReady: false
      });
    },

    // Start watching anime (delegates to the service)
    startWatching: async (animeList: AnimeForNotification[]) => {
      await animeNotificationService.startWatching(animeList);
      update(store => ({ ...store, isReady: animeNotificationService.isReady() }));
    },

    // Trigger immediate update
    triggerImmediateUpdate: () => {
      animeNotificationService.triggerImmediateUpdate();
    },

    // Check if service is ready
    isReady: (): Readable<boolean> => {
      return derived([{ subscribe }], ([$store]) => $store.isReady);
    }
  };
}

// Export the singleton store
export const animeNotificationStore = createAnimeNotificationStore();

// Auto-initialize when imported (similar to React hook behavior)
if (typeof window !== 'undefined') {
  animeNotificationStore.initialize();
}