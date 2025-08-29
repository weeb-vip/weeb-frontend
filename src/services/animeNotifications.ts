import debug from '../utils/debug';
import { useAnimeCountdownStore } from '../stores/animeCountdownStore';

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
  (animeId: string, countdown: string, isAiring: boolean, hasAired: boolean, progress?: number): void;
}

class AnimeNotificationService {
  private worker: Worker | null = null;
  private notificationCallback?: NotificationCallback;
  private countdownCallback?: CountdownCallback;
  private isWorkerReady: boolean = false;

  setNotificationCallback(callback: NotificationCallback) {
    this.notificationCallback = callback;
  }

  setCountdownCallback(callback: CountdownCallback) {
    this.countdownCallback = callback;
  }

  private setupWorkerListeners() {
    if (!this.worker) return;

    this.worker.addEventListener('message', (event) => {
      const message = event.data;

      if (message.type === 'notification') {
        debug.anime(`📺 ${message.notificationType === 'warning' ? '5-minute warning' : 'Now airing'}: ${message.anime.titleEn || message.anime.titleJp}`);

        if (this.notificationCallback) {
          this.notificationCallback(message.notificationType, message.anime);
        }
      } else if (message.type === 'countdown') {
        // Update Zustand store directly
        useAnimeCountdownStore.getState().setCountdown(message.animeId, {
          countdown: message.countdown,
          isAiring: message.isAiring,
          hasAired: message.hasAired,
          progress: message.progress
        });

        // Keep the callback for backwards compatibility
        if (this.countdownCallback) {
          this.countdownCallback(message.animeId, message.countdown, message.isAiring, message.hasAired, message.progress);
        }
      }
    });

    this.worker.addEventListener('error', (error) => {
      debug.error('Anime notification worker error details:', JSON.stringify({
        message: error.message,
        filename: error.filename,
        lineno: error.lineno,
        colno: error.colno,
        error: error.error
      }));
    });
  }

  private async initWorker() {
    if (this.worker) return;

    try {
      // Use Vite's ?worker import to force TypeScript compilation
      const { default: WorkerConstructor } = await import('../workers/animeNotifications.worker.ts?worker');
      this.worker = new WorkerConstructor();
      this.setupWorkerListeners();
      debug.info('Worker created successfully');
    } catch (error) {
      debug.error('Failed to create worker:', error);
      return;
    }
  }

  async startWatching(animeList: AnimeForNotification[]) {
    await this.initWorker();

    debug.info(`🔔 Starting to watch ${animeList.length} anime for notifications`);

    if (this.worker) {
      this.worker.postMessage({
        type: 'startWatching',
        animeList
      });
      this.isWorkerReady = true;
      debug.info('🔔 Worker is now ready');
    }
  }

  clearAll() {
    if (this.worker) {
      this.worker.postMessage({ type: 'stopWatching' });
    }
  }

  setDevTimeOffset(offsetMs: number) {
    if (this.worker) {
      this.worker.postMessage({
        type: 'setTimeOffset',
        offsetMs
      });
    }
  }

  triggerImmediateUpdate() {
    if (this.worker && this.isWorkerReady) {
      debug.info('🔔 Sending triggerUpdate message to worker');
      this.worker.postMessage({
        type: 'triggerUpdate'
      });
    } else {
      debug.warn('🔔 Worker not ready for triggerUpdate', { hasWorker: !!this.worker, isReady: this.isWorkerReady });
    }
  }

  isReady(): boolean {
    return this.isWorkerReady;
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
