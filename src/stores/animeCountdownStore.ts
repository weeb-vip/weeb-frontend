import { create } from 'zustand';
import debug from '../utils/debug';

interface CountdownData {
  countdown: string;
  isAiring: boolean;
  hasAired: boolean;
  progress?: number;
}

interface AnimeCountdownStore {
  countdowns: Record<string, CountdownData>;
  setCountdown: (animeId: string, data: CountdownData) => void;
  getCountdown: (animeId: string) => CountdownData | undefined;
  clearAll: () => void;
}

export const useAnimeCountdownStore = create<AnimeCountdownStore>((set, get) => ({
  countdowns: {},

  setCountdown: (animeId: string, data: CountdownData) => {
    set((state) => ({
      countdowns: {
        ...state.countdowns,
        [animeId]: data
      }
    }));
  },

  getCountdown: (animeId: string) => {
    const result = get().countdowns[animeId];
    debug.info(`🔔 Store: Getting countdown for ${animeId}:`, result);
    return result;
  },

  clearAll: () => {
    debug.info('🔔 Store: Clearing all countdown data');
    set({ countdowns: {} });
  }
}));
