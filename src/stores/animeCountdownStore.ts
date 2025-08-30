import { create } from 'zustand';
import { devtools } from 'zustand/middleware';   // ← add this
import debug from '../utils/debug';

const DEVTOOLS_ON = typeof window !== 'undefined' && (import.meta as any)?.env?.DEV;

interface AnimeTimingData {
  countdown: string;
  isAiring: boolean;
  hasAired: boolean;
  progress?: number;
  isAiringToday: boolean;
  isCurrentlyAiring: boolean;
  hasAlreadyAired: boolean;
  airDateTime: string;
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

export const useAnimeCountdownStore = create<AnimeTimingStore>()(
  devtools(
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

        return result;
      },

      clearAll: () => {
        debug.info('🔔 Store: Clearing all timing data');
        set({ timingData: {}, countdowns: {} }, false, { type: 'animeTiming/clearAll' });
      },
    }),
    {
      name: 'AnimeTimingStore',
      enabled: DEVTOOLS_ON, // avoids SSR/worker/test crashes
    }
  )
);
