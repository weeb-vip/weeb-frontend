import { useEffect, useState } from 'react';
import { animeNotificationService } from '../services/animeNotifications';

interface CountdownState {
  countdown: string;
  isAiring: boolean;
  hasAired: boolean;
}

export const useAnimeCountdowns = () => {
  const [countdowns, setCountdowns] = useState<Record<string, CountdownState>>({});

  useEffect(() => {
    // Set up countdown callback
    animeNotificationService.setCountdownCallback((animeId, countdown, isAiring, hasAired) => {
      setCountdowns(prev => ({
        ...prev,
        [animeId]: { countdown, isAiring, hasAired }
      }));
    });

    // Cleanup on unmount
    return () => {
      // Note: We don't clear the callback here as other components might be using it
    };
  }, []);

  return {
    getCountdown: (animeId: string) => countdowns[animeId],
    getAllCountdowns: () => countdowns
  };
};