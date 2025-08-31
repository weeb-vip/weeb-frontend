import debug from '../utils/debug';
import {createStore} from "../services/zustand.middleware";


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
  setTimingData: (animeId: string, data: AnimeTimingData) => void;
  getTimingData: (animeId: string) => AnimeTimingData | undefined;
  clearAll: () => void;

  countdowns: Record<string, Pick<AnimeTimingData, 'countdown' | 'isAiring' | 'hasAired' | 'progress'>>;
  setCountdown: (animeId: string, data: Pick<AnimeTimingData, 'countdown' | 'isAiring' | 'hasAired' | 'progress'>) => void;
  getCountdown: (animeId: string) => Pick<AnimeTimingData, 'countdown' | 'isAiring' | 'hasAired' | 'progress'> | undefined;
}

export const useAnimeCountdownStore = createStore<AnimeTimingStore>(
  'AnimeTimingStore',
  (set, get) => ({
    timingData: {},
    countdowns: {},

    setTimingData: (animeId, data) => {
      set((state) => {
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
        return { timingData: newTimingData, countdowns: newCountdowns };
      }, false, { type: 'animeTiming/setTimingData', animeId });
    },

    getTimingData: (animeId) => {
      const result = get().timingData[animeId];

      return result;
    },

    setCountdown: (animeId, data) => {
      const currentData = get().timingData[animeId];
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
      get().setTimingData(animeId, updatedData);
    },

    getCountdown: (animeId) => {
      const result = get().countdowns[animeId];
      debug.info(`🔔 Store: Getting countdown for ${animeId}:`, result);
      return result;
    },

    clearAll: () => {
      debug.info('🔔 Store: Clearing all timing data');
      set({ timingData: {}, countdowns: {} }, false, { type: 'animeTiming/clearAll' });
    },
  })
);
