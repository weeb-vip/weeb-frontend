import { animeNotificationStore } from './animeNotifications';
import { animeNotificationService, type AnimeForNotification } from '../../services/animeNotifications';
import { authenticatedRequest } from '../../services/queries';
import { getCurrentlyAiringWithDates } from '../../services/api/graphql/queries';
import { animeToast } from '../utils/animeToast';
import debug from '../../utils/debug';

// Notification tracking with localStorage and TTL
interface NotificationRecord {
  timestamp: number;
  type: string;
  animeId: string;
  episodeNumber?: number;
}

class NotificationTracker {
  private readonly STORAGE_KEY = 'anime_notifications_sent';
  private readonly TTL_MS = 60 * 60 * 1000; // 1 hour in milliseconds

  private getRecords(): NotificationRecord[] {
    if (typeof window === 'undefined') return [];

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];

      const records: NotificationRecord[] = JSON.parse(stored);
      const now = Date.now();

      // Filter out expired records
      const validRecords = records.filter(r => (now - r.timestamp) < this.TTL_MS);

      // Update storage if we removed any expired records
      if (validRecords.length !== records.length) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(validRecords));
        debug.info(`🔔 Cleaned up ${records.length - validRecords.length} expired notification records`);
      }

      return validRecords;
    } catch (error) {
      debug.error('🔔 Failed to read notification records:', error);
      return [];
    }
  }

  hasBeenSent(type: string, animeId: string, episodeNumber?: number): boolean {
    const records = this.getRecords();
    return records.some(r =>
      r.type === type &&
      r.animeId === animeId &&
      r.episodeNumber === episodeNumber
    );
  }

  markAsSent(type: string, animeId: string, episodeNumber?: number): void {
    if (typeof window === 'undefined') return;

    try {
      const records = this.getRecords();
      records.push({
        timestamp: Date.now(),
        type,
        animeId,
        episodeNumber
      });

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(records));
      debug.info(`🔔 Marked notification as sent: ${type} for anime ${animeId}${episodeNumber ? ` episode ${episodeNumber}` : ''}`);
    } catch (error) {
      debug.error('🔔 Failed to save notification record:', error);
    }
  }

  clearAll(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.STORAGE_KEY);
    debug.info('🔔 Cleared all notification records');
  }
}

// Global singleton to ensure notifications are only initialized once per browser session
class AnimeNotificationManager {
  private isInitialized = false;
  private hasSetCallback = false;
  private isWatching = false;
  private tracker = new NotificationTracker();

  async initialize() {
    // Check if already initialized in this browser session
    if (typeof window !== 'undefined') {
      this.isInitialized = (window as any).__animeNotificationsInitialized || false;
      this.hasSetCallback = (window as any).__animeCallbackSet || false;
      this.isWatching = (window as any).__animeWatching || false;
    }

    if (this.isInitialized) {
      debug.info('🔔 Svelte: Anime notifications already initialized, skipping');
      return;
    }

    try {
      debug.info('🔔 Svelte: First-time initialization of anime notifications');

      // Set up notification callback ONCE
      if (!this.hasSetCallback) {
        debug.info('🔔 Svelte: Setting up notification callback with deduplication');
        animeNotificationService.setNotificationCallback((type, anime, episode) => {
          debug.info('🔔 NOTIFICATION CALLBACK TRIGGERED!', { type, anime, episode });

          // Check if we've already sent this notification
          const notificationKey = `${type}-${anime.id}-${episode?.episodeNumber || 'none'}`;
          if (this.tracker.hasBeenSent(type, anime.id, episode?.episodeNumber)) {
            debug.info(`🔔 Skipping duplicate notification: ${notificationKey}`);
            return;
          }

          // Mark as sent before showing to prevent rapid duplicates
          this.tracker.markAsSent(type, anime.id, episode?.episodeNumber);

          switch (type) {
            case 'warning':
              debug.info('🔔 Showing warning toast');
              animeToast.warning(anime, episode);
              break;

            case 'airing-soon':
              debug.info('🔔 Showing airing-soon toast');
              animeToast.airingSoon(anime, episode, 30);
              break;

            case 'airing':
              debug.info('🔔 Showing now airing toast');
              animeToast.nowAiring(anime, episode);
              break;

            case 'finished-airing':
              debug.info('🔔 Showing finished airing toast');
              animeToast.finished(anime, episode);
              break;

            default:
              debug.info('🔔 Unknown notification type:', type);
          }
        });
        this.hasSetCallback = true;
        if (typeof window !== 'undefined') {
          (window as any).__animeCallbackSet = true;
        }
      }

      // Initialize the store ONCE
      animeNotificationStore.initialize();

      // Only start watching if not already watching
      if (!this.isWatching) {
        debug.info('🔔 Svelte: Starting anime watching service');

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

          // Start watching for notifications ONCE
          await animeNotificationStore.startWatching(animeForNotifications);
          debug.info(`🔔 Svelte: Started watching ${animeForNotifications.length} anime for notifications`);

          this.isWatching = true;
          if (typeof window !== 'undefined') {
            (window as any).__animeWatching = true;
          }

          // Only trigger immediate update on first initialization
          setTimeout(() => {
            debug.info('🔔 Svelte: Triggering initial update after startWatching');
            animeNotificationStore.triggerImmediateUpdate();
          }, 50);
        }
      }

      // Mark as initialized
      this.isInitialized = true;
      if (typeof window !== 'undefined') {
        (window as any).__animeNotificationsInitialized = true;
      }
    } catch (error) {
      debug.error('🔔 Svelte: Failed to initialize anime notifications:', error);
    }
  }

  cleanup() {
    if (this.isInitialized) {
      debug.info('🔔 Svelte: Cleaning up anime notifications');
      animeNotificationStore.clearAll();
      animeNotificationService.stop();
      this.tracker.clearAll(); // Clear notification history on cleanup
      this.isInitialized = false;
      this.hasSetCallback = false;
      this.isWatching = false;
      if (typeof window !== 'undefined') {
        (window as any).__animeNotificationsInitialized = false;
        (window as any).__animeCallbackSet = false;
        (window as any).__animeWatching = false;
      }
    }
  }
}

// Create singleton instance
const notificationManager = new AnimeNotificationManager();

// Global initialization function for client-side script
if (typeof window !== 'undefined') {
  (window as any).__initAnimeNotifications = () => {
    if (!window.__animeNotificationsInitialized) {
      debug.info('🔔 Global script initializing anime notifications');
      notificationManager.initialize().catch(error => {
        debug.error('🔔 Failed to initialize notifications:', error);
      });

      // Set up cleanup on page unload
      window.addEventListener('beforeunload', () => {
        notificationManager.cleanup();
      });
    }
  };
}

// Export functions that use the singleton (mostly for manual control if needed)
export async function initializeAnimeNotifications() {
  return notificationManager.initialize();
}

export function cleanupAnimeNotifications() {
  return notificationManager.cleanup();
}