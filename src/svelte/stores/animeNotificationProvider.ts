import { animeNotificationStore } from './animeNotifications';
import { animeNotificationService, type AnimeForNotification } from '../../services/animeNotifications';
import { authenticatedRequest } from '../../services/queries';
import { getCurrentlyAiringWithDates } from '../../services/api/graphql/queries';
import debug from '../../utils/debug';

// Svelte equivalent of useAnimeNotifications hook using manual fetch to avoid ReadableStream issues
export async function initializeAnimeNotifications() {
  try {
    debug.info('🔔 Svelte: Initializing anime notifications');

    // Initialize the store
    animeNotificationStore.initialize();

    // Manually fetch currently airing data to avoid reactive query issues
    const data = await authenticatedRequest(async (client) => {
      return client.request(getCurrentlyAiringWithDates, {
        input: {
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
          daysInFuture: 7
        }
      });
    });

    if (data?.currentlyAiring) {
      debug.info('🔔 Svelte: Setting up anime notifications with data');

      // Convert currently airing data to notification format
      const animeForNotifications: AnimeForNotification[] = data.currentlyAiring.map(anime => ({
        id: anime.id,
        titleEn: anime.titleEn,
        titleJp: anime.titleJp,
        imageUrl: anime.imageUrl,
        duration: anime.duration,
        broadcast: anime.broadcast,
        episodes: anime.episodes
      }));

      // Start watching for notifications
      await animeNotificationStore.startWatching(animeForNotifications);
      debug.info(`🔔 Svelte: Started watching ${animeForNotifications.length} anime for notifications`);

      // Trigger immediate update to get initial data
      setTimeout(() => {
        debug.info('🔔 Svelte: Triggering immediate update after startWatching');
        animeNotificationStore.triggerImmediateUpdate();
      }, 50);
    }
  } catch (error) {
    debug.error('🔔 Svelte: Failed to initialize anime notifications:', error);
  }
}

// Cleanup function
export function cleanupAnimeNotifications() {
  debug.info('🔔 Svelte: Cleaning up anime notifications');
  animeNotificationStore.clearAll();
  animeNotificationService.stop();
}