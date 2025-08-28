import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCurrentlyAiring } from '../services/queries';
import { animeNotificationService, AnimeForNotification } from '../services/animeNotifications';
import { useToast } from '../components/Toast';
import { CurrentlyAiringQuery } from '../gql/graphql';
import debug from '../utils/debug';

export const useAnimeNotifications = () => {
  const { showToast } = useToast();
  
  // Get currently airing anime data
  const { data: currentlyAiringData, isSuccess } = useQuery<CurrentlyAiringQuery>(
    fetchCurrentlyAiring()
  );

  useEffect(() => {
    if (!isSuccess || !currentlyAiringData?.currentlyAiring) {
      debug.info('No currently airing data available for notifications');
      return;
    }

    // Set up notification callback
    animeNotificationService.setNotificationCallback((type, anime) => {
      const episodeNumber = anime.nextEpisode?.episodeNumber || 'Unknown';
      const episodeTitle = anime.nextEpisode?.titleEn || anime.nextEpisode?.titleJp || 'Unknown';
      const animeTitle = anime.titleEn || anime.titleJp || 'Unknown Anime';

      if (type === 'warning') {
        showToast({
          type: 'warning',
          title: 'Anime Airing Soon',
          message: `Episode ${episodeNumber} starts in 5 minutes`,
          duration: 8000,
          anime: {
            id: anime.id,
            titleEn: anime.titleEn,
            titleJp: anime.titleJp,
            imageUrl: anime.imageUrl
          }
        });
        debug.anime(`📺 5-minute warning: ${animeTitle} Episode ${episodeNumber}`);
      } else if (type === 'airing') {
        showToast({
          type: 'info',
          title: 'Now Airing',
          message: `Episode ${episodeNumber}: ${episodeTitle}`,
          duration: 10000,
          anime: {
            id: anime.id,
            titleEn: anime.titleEn,
            titleJp: anime.titleJp,
            imageUrl: anime.imageUrl
          }
        });
        debug.anime(`🔴 Now airing: ${animeTitle} Episode ${episodeNumber}`);
      }
    });

    // Convert currently airing data to notification format
    const animeForNotifications: AnimeForNotification[] = currentlyAiringData.currentlyAiring.map(anime => ({
      id: anime.id,
      titleEn: anime.titleEn,
      titleJp: anime.titleJp,
      imageUrl: anime.imageUrl,
      duration: anime.duration,
      broadcast: anime.broadcast,
      nextEpisode: anime.nextEpisode
    }));

    // Start watching for notifications
    animeNotificationService.startWatching(animeForNotifications);
    debug.info(`🔔 Started watching ${animeForNotifications.length} anime for notifications`);

    // Cleanup on unmount or data change
    return () => {
      animeNotificationService.clearAll();
    };
  }, [isSuccess, currentlyAiringData, showToast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      animeNotificationService.stop();
    };
  }, []);
};