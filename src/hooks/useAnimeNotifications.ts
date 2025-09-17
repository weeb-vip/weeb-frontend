import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCurrentlyAiringWithDates} from '../services/queries';
import { animeNotificationService, type AnimeForNotification } from '../services/animeNotifications';
import { useToast } from '../components/Toast';
import { type CurrentlyAiringWithDateQuery} from '../gql/graphql';
import debug from '../utils/debug';

export const useAnimeNotifications = () => {
  const { showToast } = useToast();

  // Get currently airing anime data
  const { data: currentlyAiringData, isSuccess } = useQuery<CurrentlyAiringWithDateQuery>(
    // past day to next 7 days
    fetchCurrentlyAiringWithDates(new Date(Date.now() - 24 * 60 * 60 * 1000), null, 7)
  );

  useEffect(() => {
    if (!isSuccess || !currentlyAiringData?.currentlyAiring) {
      debug.info('No currently airing data available for notifications');
      return;
    }

    // Set up notification callback
    animeNotificationService.setNotificationCallback((type, anime, episode) => {
      const episodeNumber = episode?.episodeNumber || 'Unknown';
      const episodeTitle = episode?.titleEn || episode?.titleJp || 'Unknown';
      const animeTitle = anime.titleEn || anime.titleJp || 'Unknown Anime';

      const animeInfo = {
        id: anime.id,
        titleEn: anime.titleEn,
        titleJp: anime.titleJp,
        imageUrl: anime.imageUrl
      };

      switch (type) {
        case 'warning':
          showToast({
            type: 'warning',
            title: 'Anime Airing Soon',
            message: `Episode ${episodeNumber} starts in 5 minutes`,
            duration: 8000,
            anime: animeInfo
          });
          debug.anime(`📺 5-minute warning: ${animeTitle} Episode ${episodeNumber}`);
          break;

        case 'airing-soon':
          showToast({
            type: 'info',
            title: 'Anime Airing Soon',
            message: `Episode ${episodeNumber} starts in 30 minutes`,
            duration: 6000,
            anime: animeInfo
          });
          debug.anime(`📺 30-minute notice: ${animeTitle} Episode ${episodeNumber}`);
          break;

        case 'airing':
          showToast({
            type: 'info',
            title: 'Now Airing',
            message: `Episode ${episodeNumber}: ${episodeTitle}`,
            duration: 10000,
            anime: animeInfo
          });
          debug.anime(`🔴 Now airing: ${animeTitle} Episode ${episodeNumber}`);
          break;

        case 'finished-airing':
          showToast({
            type: 'success',
            title: 'Episode Finished',
            message: `Episode ${episodeNumber} has finished airing`,
            duration: 8000,
            anime: animeInfo
          });
          debug.anime(`✅ Finished airing: ${animeTitle} Episode ${episodeNumber}`);
          break;
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
      episodes: anime.episodes
    }));

    // Start watching for notifications
    animeNotificationService.startWatching(animeForNotifications);
    debug.info(`🔔 Started watching ${animeForNotifications.length} anime for notifications`);

    // Immediately trigger update to get initial data
    setTimeout(() => {
      debug.info('🔔 Triggering immediate update after startWatching');
      animeNotificationService.triggerImmediateUpdate();
    }, 50); // Small delay to ensure worker processed the anime list



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
