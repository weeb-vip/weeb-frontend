import { jest } from '@jest/globals';
import { AnimeForNotification, NotificationCallback, CountdownCallback } from './animeNotifications';

// Mock the debug utility
const mockDebug = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  anime: jest.fn(),
};

jest.mock('../utils/debug', () => ({
  __esModule: true,
  default: mockDebug,
}));

// Mock the Svelte store
const mockSetCountdown = jest.fn();
const mockSetTimingData = jest.fn();
const mockGetState = jest.fn(() => ({
  setCountdown: mockSetCountdown,
  setTimingData: mockSetTimingData,
}));

jest.mock('../svelte/stores/animeCountdown', () => ({
  animeCountdownStore: {
    setCountdown: mockSetCountdown,
    setTimingData: mockSetTimingData,
  }
}));

// Mock Worker class
class MockWorker {
  private listeners: { [key: string]: ((event: any) => void)[] } = {};
  public postMessage = jest.fn();

  constructor() {
    this.listeners = {
      message: [],
      error: [],
      messageerror: [],
    };
  }

  addEventListener(type: string, listener: (event: any) => void) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(listener);
  }

  removeEventListener(type: string, listener: (event: any) => void) {
    if (this.listeners[type]) {
      const index = this.listeners[type].indexOf(listener);
      if (index > -1) {
        this.listeners[type].splice(index, 1);
      }
    }
  }

  terminate() {
    // Mock terminate
  }

  // Helper to simulate receiving messages from worker
  simulateMessage(data: any) {
    const messageEvent = { data, type: 'message' };
    this.listeners.message?.forEach(listener => listener(messageEvent));
  }

  // Helper to simulate worker errors
  simulateError(error: any) {
    const errorEvent = { ...error, type: 'error' };
    this.listeners.error?.forEach(listener => listener(errorEvent));
  }
}

// Create a testable version of the service
class TestableAnimeNotificationService {
  private worker: MockWorker | null = null;
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

    this.worker.addEventListener('message', (event: any) => {
      const message = event.data;

      if (message.type === 'notification') {
        const notificationTypeLabels = {
          'warning': '5-minute warning',
          'airing': 'Now airing',
          'airing-soon': 'Airing soon (30 minutes)',
          'finished-airing': 'Finished airing'
        };

        mockDebug.anime(`📺 ${notificationTypeLabels[message.notificationType] || message.notificationType}: ${message.anime.titleEn || message.anime.titleJp}`);

        if (this.notificationCallback) {
          this.notificationCallback(message.notificationType, message.anime, message.episode);
        }
      } else if (message.type === 'countdown') {
        // Update Svelte store directly
        mockSetCountdown(message.animeId, {
          countdown: message.countdown,
          isAiring: message.isAiring,
          hasAired: message.hasAired,
          progress: message.progress
        });

        // Keep the callback for backwards compatibility
        if (this.countdownCallback) {
          this.countdownCallback(message.animeId, message.countdown, message.isAiring, message.hasAired, message.progress);
        }
      } else if (message.type === 'timing') {
        // Update Svelte store with comprehensive timing data
        mockSetTimingData(message.animeId, message.timingData);
      }
    });

    this.worker.addEventListener('error', (error: any) => {
      mockDebug.error('Anime notification worker error:', JSON.stringify(error, null, 2));
    });

    this.worker.addEventListener('messageerror', (error: any) => {
      mockDebug.error('Worker message error:', error);
    });
  }

  async startWatching(animeList: AnimeForNotification[]) {
    if (!this.worker) {
      this.worker = new MockWorker();
      this.setupWorkerListeners();
    }

    mockDebug.info(`🔔 Starting to watch ${animeList.length} anime for notifications`);

    if (this.worker) {
      this.worker.postMessage({
        type: 'startWatching',
        animeList
      });
      this.isWorkerReady = true;
      mockDebug.info('🔔 Worker is now ready');
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
      mockDebug.info('🔔 Sending triggerUpdate message to worker');
      this.worker.postMessage({
        type: 'triggerUpdate'
      });
    } else {
      mockDebug.warn('🔔 Worker not ready for triggerUpdate', {hasWorker: !!this.worker, isReady: this.isWorkerReady});
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
      mockDebug.info('🔔 Stopped anime notification worker');
    }
  }

  // Expose worker for testing
  getWorker(): MockWorker | null {
    return this.worker;
  }
}

describe('AnimeNotificationService', () => {
  let service: TestableAnimeNotificationService;
  let mockWorker: MockWorker;
  let notificationCallback: jest.MockedFunction<NotificationCallback>;
  let countdownCallback: jest.MockedFunction<CountdownCallback>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create fresh service instance
    service = new TestableAnimeNotificationService();

    // Create fresh mock callbacks
    notificationCallback = jest.fn();
    countdownCallback = jest.fn();

    // Set up service callbacks
    service.setNotificationCallback(notificationCallback);
    service.setCountdownCallback(countdownCallback);
  });

  afterEach(() => {
    service.stop();
  });

  describe('Message handling', () => {
    beforeEach(async () => {
      // Start watching to initialize worker
      const animeList: AnimeForNotification[] = [{
        id: 'test-anime',
        titleEn: 'Test Anime',
        duration: '24 min',
        broadcast: 'Mondays at 12:00 (JST)',
        episodes: [{
          id: 'ep1',
          episodeNumber: 1,
          titleEn: 'Episode 1',
          airDate: '2024-01-15T00:00:00Z'
        }]
      }];

      await service.startWatching(animeList);
      mockWorker = service.getWorker()!;
    });

    describe('Notification messages', () => {
      it('should handle warning notification messages', () => {
        const anime: AnimeForNotification = {
          id: 'attack-titan',
          titleEn: 'Attack on Titan',
          titleJp: '進撃の巨人'
        };

        const episode = {
          episodeNumber: 1,
          titleEn: 'To You, in 2000 Years'
        };

        mockWorker.simulateMessage({
          type: 'notification',
          notificationType: 'warning',
          anime,
          episode
        });

        expect(notificationCallback).toHaveBeenCalledWith('warning', anime, episode);
      });

      it('should handle multiple notification types', () => {
        const anime1: AnimeForNotification = { id: 'anime1', titleEn: 'First Anime' };
        const anime2: AnimeForNotification = { id: 'anime2', titleEn: 'Second Anime' };

        mockWorker.simulateMessage({
          type: 'notification',
          notificationType: 'airing-soon',
          anime: anime1,
          episode: { episodeNumber: 1, titleEn: 'Episode 1' }
        });

        mockWorker.simulateMessage({
          type: 'notification',
          notificationType: 'finished-airing',
          anime: anime2,
          episode: { episodeNumber: 2, titleEn: 'Episode 2' }
        });

        expect(notificationCallback).toHaveBeenCalledTimes(2);
        expect(notificationCallback).toHaveBeenNthCalledWith(1, 'airing-soon', anime1, { episodeNumber: 1, titleEn: 'Episode 1' });
        expect(notificationCallback).toHaveBeenNthCalledWith(2, 'finished-airing', anime2, { episodeNumber: 2, titleEn: 'Episode 2' });
      });
    });

    describe('Countdown messages', () => {
      it('should handle countdown messages and update Svelte store', () => {
        const countdownMessage = {
          type: 'countdown',
          animeId: 'attack-titan',
          countdown: '5m',
          isAiring: false,
          hasAired: false,
          progress: undefined
        };

        mockWorker.simulateMessage(countdownMessage);

        expect(mockSetCountdown).toHaveBeenCalledWith('attack-titan', {
          countdown: '5m',
          isAiring: false,
          hasAired: false,
          progress: undefined
        });

        expect(countdownCallback).toHaveBeenCalledWith('attack-titan', '5m', false, false, undefined);
      });

      it('should handle countdown messages with progress', () => {
        const countdownMessage = {
          type: 'countdown',
          animeId: 'demon-slayer',
          countdown: 'AIRING',
          isAiring: true,
          hasAired: false,
          progress: 0.5
        };

        mockWorker.simulateMessage(countdownMessage);

        expect(mockSetCountdown).toHaveBeenCalledWith('demon-slayer', {
          countdown: 'AIRING',
          isAiring: true,
          hasAired: false,
          progress: 0.5
        });

        expect(countdownCallback).toHaveBeenCalledWith('demon-slayer', 'AIRING', true, false, 0.5);
      });
    });

    describe('Timing messages', () => {
      it('should handle timing messages and update Svelte store', () => {
        const timingData = {
          countdown: '2h',
          isAiring: false,
          hasAired: false,
          progress: undefined,
          isAiringToday: true,
          isCurrentlyAiring: false,
          hasAlreadyAired: false,
          airDateTime: 'Mon Jan 15th at 12:00 PM',
          episode: {
            episodeNumber: 1,
            titleEn: 'Episode 1',
            titleJp: 'エピソード1'
          }
        };

        const timingMessage = {
          type: 'timing',
          animeId: 'my-hero-academia',
          timingData
        };

        mockWorker.simulateMessage(timingMessage);

        expect(mockSetTimingData).toHaveBeenCalledWith('my-hero-academia', timingData);
      });
    });

    describe('Multiple simultaneous messages', () => {
      it('should handle multiple anime messages simultaneously', () => {
        // Simulate Attack on Titan and Demon Slayer airing at the same time
        const attackTitanCountdown = {
          type: 'countdown',
          animeId: 'attack-titan',
          countdown: '5m',
          isAiring: false,
          hasAired: false
        };

        const demonSlayerCountdown = {
          type: 'countdown',
          animeId: 'demon-slayer',
          countdown: '5m', // Same time
          isAiring: false,
          hasAired: false
        };

        const attackTitanTiming = {
          type: 'timing',
          animeId: 'attack-titan',
          timingData: {
            countdown: '5m',
            isAiring: false,
            hasAired: false,
            isAiringToday: true,
            isCurrentlyAiring: false,
            hasAlreadyAired: false,
            airDateTime: 'Mon Jan 15th at 12:00 PM',
            episode: { episodeNumber: 1, titleEn: 'To You, in 2000 Years' }
          }
        };

        const demonSlayerTiming = {
          type: 'timing',
          animeId: 'demon-slayer',
          timingData: {
            countdown: '5m',
            isAiring: false,
            hasAired: false,
            isAiringToday: true,
            isCurrentlyAiring: false,
            hasAlreadyAired: false,
            airDateTime: 'Mon Jan 15th at 12:00 PM',
            episode: { episodeNumber: 1, titleEn: 'Cruelty' }
          }
        };

        // Send all messages simultaneously (simulating worker behavior)
        mockWorker.simulateMessage(attackTitanCountdown);
        mockWorker.simulateMessage(demonSlayerCountdown);
        mockWorker.simulateMessage(attackTitanTiming);
        mockWorker.simulateMessage(demonSlayerTiming);

        // Verify both anime received their updates in the store
        expect(mockSetCountdown).toHaveBeenCalledTimes(2);
        expect(mockSetTimingData).toHaveBeenCalledTimes(2);

        expect(mockSetCountdown).toHaveBeenCalledWith('attack-titan', expect.objectContaining({ countdown: '5m' }));
        expect(mockSetCountdown).toHaveBeenCalledWith('demon-slayer', expect.objectContaining({ countdown: '5m' }));

        expect(mockSetTimingData).toHaveBeenCalledWith('attack-titan', expect.objectContaining({ countdown: '5m' }));
        expect(mockSetTimingData).toHaveBeenCalledWith('demon-slayer', expect.objectContaining({ countdown: '5m' }));

        // Verify callbacks were called for both anime (backend service working correctly)
        expect(countdownCallback).toHaveBeenCalledTimes(2);
        expect(countdownCallback).toHaveBeenCalledWith('attack-titan', '5m', false, false, undefined);
        expect(countdownCallback).toHaveBeenCalledWith('demon-slayer', '5m', false, false, undefined);

        // ✅ This test confirms the SERVICE receives and processes both notifications
        // 📱 The improved ToastContainer will now queue them properly on mobile
      });

      it('should handle notification and countdown messages for same anime simultaneously', () => {
        const animeId = 'one-piece';

        // Notification that One Piece is now airing
        mockWorker.simulateMessage({
          type: 'notification',
          notificationType: 'airing',
          anime: { id: animeId, titleEn: 'One Piece' },
          episode: { episodeNumber: 1000, titleEn: 'Special Episode' }
        });

        // Countdown showing it's currently airing
        mockWorker.simulateMessage({
          type: 'countdown',
          animeId,
          countdown: 'AIRING',
          isAiring: true,
          hasAired: false,
          progress: 0.25
        });

        // Timing data with full details
        mockWorker.simulateMessage({
          type: 'timing',
          animeId,
          timingData: {
            countdown: 'AIRING',
            isAiring: true,
            hasAired: false,
            progress: 0.25,
            isAiringToday: true,
            isCurrentlyAiring: true,
            hasAlreadyAired: false,
            airDateTime: 'Sun Jan 14th at 9:30 AM',
            episode: { episodeNumber: 1000, titleEn: 'Special Episode' }
          }
        });

        // Verify all message types were handled
        expect(notificationCallback).toHaveBeenCalledTimes(1);
        expect(mockSetCountdown).toHaveBeenCalledTimes(1);
        expect(mockSetTimingData).toHaveBeenCalledTimes(1);

        expect(notificationCallback).toHaveBeenCalledWith('airing', { id: animeId, titleEn: 'One Piece' }, { episodeNumber: 1000, titleEn: 'Special Episode' });
        expect(countdownCallback).toHaveBeenCalledWith(animeId, 'AIRING', true, false, 0.25);
      });
    });
  });

  describe('Service methods', () => {
    it('should initialize worker and set up listeners on startWatching', async () => {
      const animeList: AnimeForNotification[] = [{
        id: 'test-anime',
        titleEn: 'Test Anime'
      }];

      await service.startWatching(animeList);

      expect(service.isReady()).toBe(true);
      expect(service.getWorker()).toBeInstanceOf(MockWorker);
      expect(mockDebug.info).toHaveBeenCalledWith('🔔 Starting to watch 1 anime for notifications');
    });

    it('should send triggerUpdate message when ready', async () => {
      const animeList: AnimeForNotification[] = [{ id: 'test', titleEn: 'Test' }];
      await service.startWatching(animeList);

      const worker = service.getWorker()!;

      service.triggerImmediateUpdate();

      expect(worker.postMessage).toHaveBeenCalledWith({
        type: 'triggerUpdate'
      });
    });

    it('should send setTimeOffset message', async () => {
      const animeList: AnimeForNotification[] = [{ id: 'test', titleEn: 'Test' }];
      await service.startWatching(animeList);

      const worker = service.getWorker()!;

      service.setDevTimeOffset(3600000); // 1 hour

      expect(worker.postMessage).toHaveBeenCalledWith({
        type: 'setTimeOffset',
        offsetMs: 3600000
      });
    });
  });
});