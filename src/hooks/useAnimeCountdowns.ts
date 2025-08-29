import { useEffect, useState } from 'react';
import { animeNotificationService } from '../services/animeNotifications';
import debug from '../utils/debug';

interface CountdownState {
  countdown: string;
  isAiring: boolean;
  hasAired: boolean;
  progress?: number; // 0-1 for airing episodes
}

export const useAnimeCountdowns = () => {
  const [countdowns, setCountdowns] = useState<Record<string, CountdownState>>({});

  useEffect(() => {
    // Set up countdown callback
    animeNotificationService.setCountdownCallback((animeId, countdown, isAiring, hasAired, progress) => {

      setCountdowns(prev => ({
        ...prev,
        [animeId]: { countdown, isAiring, hasAired, progress }
      }));
    });

    // Cleanup on unmount
    return () => {
      // Note: We don't clear the callback here as other components might be using it
    };
  }, []);

  return {
    getCountdown: (animeId: string) => {
      const result = countdowns[animeId];
      return result;
    },
    getAllCountdowns: () => countdowns
  };
};
