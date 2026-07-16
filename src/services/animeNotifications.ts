import debug from '../utils/debug';

export interface AnimeForNotification {
  id: string;
  titleEn?: string | null;
  titleJp?: string | null;
  imageUrl?: string | null;
  duration?: string | null;
  broadcast?: string | null;
  nextEpisode?: {
    id: string;
    episodeNumber?: number | null;
    titleEn?: string | null;
    titleJp?: string | null;
    airDate?: string | null;
    airTime?: string | null;
  } | null;
}

export interface NotificationCallback {
  (type: 'warning' | 'airing' | 'airing-soon' | 'finished-airing', anime: AnimeForNotification, episode?: {
    episodeNumber?: number | null;
    titleEn?: string | null;
    titleJp?: string | null
  }): void;
}

export interface CountdownCallback {
  (animeId: string, countdown: string, isAiring: boolean, hasAired: boolean, progress?: number): void;
}

export interface TimingCallback {
  (animeId: string, timingData: any): void;
}

class AnimeNotificationService {
  private worker: Worker | null = null;
  private notificationCallback?: NotificationCallback;
  private countdownCallback?: CountdownCallback;
  private timingCallback?: TimingCallback;
  private isWorkerReady: boolean = false;

  setNotificationCallback(callback: NotificationCallback) {
    this.notificationCallback = callback;
  }

  setCountdownCallback(callback: CountdownCallback) {
    this.countdownCallback = callback;
  }

  setTimingCallback(callback: TimingCallback) {
    this.timingCallback = callback;
  }

  private setupWorkerListeners() {
    if (!this.worker) return;

    this.worker.addEventListener('message', (event) => {

      const message = event.data;

      if (message.type === 'notification') {
        const notificationTypeLabels = {
          'warning': '5-minute warning',
          'airing': 'Now airing',
          'airing-soon': 'Airing soon (30 minutes)',
          'finished-airing': 'Finished airing'
        };

        debug.anime(`📺 ${notificationTypeLabels[message.notificationType] || message.notificationType}: ${message.anime.titleEn || message.anime.titleJp}`);

        if (this.notificationCallback) {
          this.notificationCallback(message.notificationType, message.anime, message.episode);
        }
      } else if (message.type === 'countdown') {
        // The store is fed through this callback (registered by
        // animeNotificationStore); there is no separate countdown store.
        if (this.countdownCallback) {
          this.countdownCallback(message.animeId, message.countdown, message.isAiring, message.hasAired, message.progress);
        }
      } else if (message.type === 'timing') {
        if (this.timingCallback) {
          this.timingCallback(message.animeId, message.timingData);
        }
      }
    });

    this.worker.addEventListener('error', (error) => {
      debug.error('Anime notification worker error:', JSON.stringify(error, null, 2));
      debug.error('Error details:', JSON.stringify({
        message: error.message || 'No message',
        filename: error.filename || 'No filename',
        lineno: error.lineno || 'No line number',
        colno: error.colno || 'No column',
        type: error.type || 'No type',
        error: error.error || 'No error object'
      }, null, 2));
    });

    this.worker.addEventListener('messageerror', (error) => {
      debug.error('Worker message error:', error);
    });
  }

  private async initWorker() {

    if (this.worker) return;

    try {
      // Use Vite's ?worker import to force TypeScript compilation
      const {default: WorkerConstructor} = await import('../workers/animeNotifications.worker.ts?worker');
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
      this.worker.postMessage({type: 'stopWatching'});
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
      debug.warn('🔔 Worker not ready for triggerUpdate', {hasWorker: !!this.worker, isReady: this.isWorkerReady});
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
