import { writable } from 'svelte/store';
import debug from '../../utils/debug';

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

interface AnimeTimingStore {
  timingData: Record<string, AnimeTimingData>;
  countdowns: Record<string, Pick<AnimeTimingData, 'countdown' | 'isAiring' | 'hasAired' | 'progress'>>;
}

function createAnimeCountdownStore() {
  const { subscribe, set, update } = writable<AnimeTimingStore>({
    timingData: {},
    countdowns: {}
  });

  return {
    subscribe,
    setTimingData: (animeId: string, data: AnimeTimingData) => {
      update(state => {
        const newTimingData = { ...state.timingData, [animeId]: data };
        const newCountdowns = {
          ...state.countdowns,
          [animeId]: {
            countdown: data.countdown,
            isAiring: data.isAiring,
            hasAired: data.hasAired,
            progress: data.progress,
          },
        };
        debug.info(`🔔 Store: Setting timing data for ${animeId}`, data);
        return { timingData: newTimingData, countdowns: newCountdowns };
      });
    },
    getTimingData: (animeId: string): AnimeTimingData | undefined => {
      let result: AnimeTimingData | undefined;
      const unsubscribe = subscribe(state => {
        result = state.timingData[animeId];
      });
      unsubscribe();
      return result;
    },
    setCountdown: (animeId: string, data: Pick<AnimeTimingData, 'countdown' | 'isAiring' | 'hasAired' | 'progress'>) => {
      update(state => {
        const currentData = state.timingData[animeId];
        const updatedData: AnimeTimingData = {
          ...currentData,
          countdown: data.countdown,
          isAiring: data.isAiring,
          hasAired: data.hasAired,
          progress: data.progress,
          isAiringToday: currentData?.isAiringToday || false,
          isCurrentlyAiring: currentData?.isCurrentlyAiring || data.isAiring,
          hasAlreadyAired: currentData?.hasAlreadyAired || data.hasAired,
          airDateTime: currentData?.airDateTime || '',
        };

        const newTimingData = { ...state.timingData, [animeId]: updatedData };
        const newCountdowns = { ...state.countdowns, [animeId]: data };

        return { timingData: newTimingData, countdowns: newCountdowns };
      });
    },
    getCountdown: (animeId: string): Pick<AnimeTimingData, 'countdown' | 'isAiring' | 'hasAired' | 'progress'> | undefined => {
      let result: Pick<AnimeTimingData, 'countdown' | 'isAiring' | 'hasAired' | 'progress'> | undefined;
      const unsubscribe = subscribe(state => {
        result = state.countdowns[animeId];
      });
      unsubscribe();
      debug.info(`🔔 Store: Getting countdown for ${animeId}:`, result);
      return result;
    },
    clearAll: () => {
      debug.info('🔔 Store: Clearing all timing data');
      set({ timingData: {}, countdowns: {} });
    },
    set,
    update
  };
}

export const animeCountdownStore = createAnimeCountdownStore();