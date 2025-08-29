import debug from '../utils/debug';

export interface AnimeForNotification {
  id: string;
  titleEn?: string | null;
  titleJp?: string | null;
  imageUrl?: string | null;
  duration?: string | null;
  broadcast?: string | null;
  nextEpisode?: {
    episodeNumber?: number | null;
    titleEn?: string | null;
    titleJp?: string | null;
    airDate?: string | null;
  } | null;
}

export interface NotificationCallback {
  (type: 'warning' | 'airing', anime: AnimeForNotification): void;
}

export interface CountdownCallback {
  (animeId: string, countdown: string, isAiring: boolean, hasAired: boolean): void;
}

class AnimeNotificationService {
  private worker: Worker | null = null;
  private notificationCallback?: NotificationCallback;
  private countdownCallback?: CountdownCallback;

  setNotificationCallback(callback: NotificationCallback) {
    this.notificationCallback = callback;
  }

  setCountdownCallback(callback: CountdownCallback) {
    this.countdownCallback = callback;
  }

  private initWorker() {
    if (this.worker) return;

    this.worker = new Worker(
      new URL('../workers/animeNotifications.worker.ts', import.meta.url),
      { type: 'module' }
    );

    this.worker.addEventListener('message', (event) => {
      const message = event.data;

      if (message.type === 'notification') {
        debug.anime(`📺 ${message.notificationType === 'warning' ? '5-minute warning' : 'Now airing'}: ${message.anime.titleEn || message.anime.titleJp}`);
        
        if (this.notificationCallback) {
          this.notificationCallback(message.notificationType, message.anime);
        }
      } else if (message.type === 'countdown') {
        if (this.countdownCallback) {
          this.countdownCallback(message.animeId, message.countdown, message.isAiring, message.hasAired);
        }
      }
    });

    this.worker.addEventListener('error', (error) => {
      debug.error('Anime notification worker error:', error);
    });
  }

  startWatching(animeList: AnimeForNotification[]) {
    this.initWorker();
    
    debug.info(`🔔 Starting to watch ${animeList.length} anime for notifications`);

    if (this.worker) {
      this.worker.postMessage({
        type: 'startWatching',
        animeList
      });
    }
  }

  clearAll() {
    if (this.worker) {
      this.worker.postMessage({ type: 'stopWatching' });
    }
  }

  stop() {
    this.clearAll();
    
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      debug.info('🔔 Stopped anime notification worker');
    }
  }
}

// Export a singleton instance
export const animeNotificationService = new AnimeNotificationService();