import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { MockedFunction } from 'vitest';
import type { AnimeForNotification, NotificationCallback, CountdownCallback } from './animeNotifications';

// Mock the debug utility. vi.mock is hoisted above the rest of the module, so
// the object its factory closes over has to be built inside vi.hoisted() --
// a plain const would still be in its temporal dead zone when the factory runs.
const mockDebug = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  anime: vi.fn(),
}));

vi.mock('$lib/utils/debug', () => ({
  __esModule: true,
  default: mockDebug,
}));

/**
 * The service `await import`s the worker through Vite's `?worker` suffix, which
 * has no meaning under vitest, so the module is replaced with a recording
 * double. Everything else below the `Real service` heading is the real
 * singleton from `./animeNotifications`.
 */
const workerState = vi.hoisted(() => ({
  failToConstruct: false,
  instances: [] as any[],
}));

vi.mock('../../workers/animeNotifications.worker.ts?worker', () => ({
  __esModule: true,
  default: class RecordingWorker {
    listeners: Record<string, ((event: any) => void)[]> = {};
    postMessage = vi.fn();
    terminate = vi.fn();

    constructor() {
      if (workerState.failToConstruct) throw new Error('worker failed to boot');
      workerState.instances.push(this);
    }

    addEventListener(type: string, listener: (event: any) => void) {
      (this.listeners[type] ||= []).push(listener);
    }

    emit(type: string, event: any) {
      (this.listeners[type] || []).forEach((listener) => listener(event));
    }
  },
}));


// Mock Worker class
class MockWorker {
  private listeners: { [key: string]: ((event: any) => void)[] } = {};
  public postMessage = vi.fn();

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
  private timingCallback?: (animeId: string, timingData: any) => void;
  private isWorkerReady: boolean = false;

  setNotificationCallback(callback: NotificationCallback) {
    this.notificationCallback = callback;
  }

  setCountdownCallback(callback: CountdownCallback) {
    this.countdownCallback = callback;
  }

  setTimingCallback(callback: (animeId: string, timingData: any) => void) {
    this.timingCallback = callback;
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
        if (this.countdownCallback) {
          this.countdownCallback(message.animeId, message.countdown, message.isAiring, message.hasAired, message.progress);
        }
      } else if (message.type === 'timing') {
        if (this.timingCallback) {
          this.timingCallback(message.animeId, message.timingData);
        }
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
  let notificationCallback: MockedFunction<NotificationCallback>;
  let countdownCallback: MockedFunction<CountdownCallback>;
  let timingCallback: MockedFunction<(animeId: string, timingData: any) => void>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create fresh service instance
    service = new TestableAnimeNotificationService();

    // Create fresh mock callbacks. These are the sole path the worker data
    // reaches the store (animeNotificationStore registers the same callbacks),
    // so asserting on them verifies the store would be updated.
    notificationCallback = vi.fn();
    countdownCallback = vi.fn();
    timingCallback = vi.fn();

    // Set up service callbacks
    service.setNotificationCallback(notificationCallback);
    service.setCountdownCallback(countdownCallback);
    service.setTimingCallback(timingCallback);
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
        nextEpisode: {
          id: 'ep1',
          episodeNumber: 1,
          titleEn: 'Episode 1',
          airDate: '2024-01-15T00:00:00Z'
        }
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

        expect(timingCallback).toHaveBeenCalledWith('my-hero-academia', timingData);
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

        // Verify both anime received their timing updates (store is fed via these callbacks)
        expect(timingCallback).toHaveBeenCalledTimes(2);
        expect(timingCallback).toHaveBeenCalledWith('attack-titan', expect.objectContaining({ countdown: '5m' }));
        expect(timingCallback).toHaveBeenCalledWith('demon-slayer', expect.objectContaining({ countdown: '5m' }));

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
        expect(countdownCallback).toHaveBeenCalledTimes(1);
        expect(timingCallback).toHaveBeenCalledTimes(1);

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

// ---------------------------------------------------------------------------
// The real singleton, not a copy of it.
//
// Everything above this line exercises a hand-written stand-in, which cannot
// catch a change to the module it mirrors. These tests import
// `animeNotificationService` itself and drive it through the recording worker
// double declared at the top of the file.
// ---------------------------------------------------------------------------

async function loadRealService() {
  vi.resetModules();
  workerState.instances.length = 0;
  const mod = await import('./animeNotifications');
  return mod.animeNotificationService;
}

const ONE_ANIME: AnimeForNotification[] = [
  { id: 'a1', titleEn: 'Frieren', broadcast: 'Fridays at 23:00 (JST)', duration: '24 min' }
];

describe('Real animeNotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workerState.failToConstruct = false;
  });

  describe('worker lifecycle', () => {
    it('creates exactly one worker and hands it the watch list', async () => {
      const service = await loadRealService();

      await service.startWatching(ONE_ANIME);

      expect(workerState.instances).toHaveLength(1);
      expect(workerState.instances[0].postMessage).toHaveBeenCalledWith({
        type: 'startWatching',
        animeList: ONE_ANIME
      });
      expect(service.isReady()).toBe(true);
      service.stop();
    });

    it('reuses the worker on a second startWatching instead of spawning another', async () => {
      const service = await loadRealService();

      await service.startWatching(ONE_ANIME);
      await service.startWatching([...ONE_ANIME, { id: 'a2', titleEn: 'Dandadan' }]);

      expect(workerState.instances).toHaveLength(1);
      expect(workerState.instances[0].postMessage).toHaveBeenCalledTimes(2);
      service.stop();
    });

    it('accepts an empty list without failing', async () => {
      const service = await loadRealService();

      await service.startWatching([]);

      expect(workerState.instances[0].postMessage).toHaveBeenCalledWith({
        type: 'startWatching',
        animeList: []
      });
      expect(mockDebug.info).toHaveBeenCalledWith('🔔 Starting to watch 0 anime for notifications');
      service.stop();
    });

    it('degrades quietly when the worker cannot be constructed', async () => {
      workerState.failToConstruct = true;
      const service = await loadRealService();

      await expect(service.startWatching(ONE_ANIME)).resolves.toBeUndefined();

      expect(service.isReady()).toBe(false);
      expect(mockDebug.error).toHaveBeenCalledWith('Failed to create worker:', expect.any(Error));
      service.stop();
    });

    it('terminates the worker on stop and tells it to stop watching first', async () => {
      const service = await loadRealService();
      await service.startWatching(ONE_ANIME);
      const worker = workerState.instances[0];

      service.stop();

      expect(worker.postMessage).toHaveBeenCalledWith({ type: 'stopWatching' });
      expect(worker.terminate).toHaveBeenCalledTimes(1);
    });

    it('builds a fresh worker after a stop', async () => {
      const service = await loadRealService();
      await service.startWatching(ONE_ANIME);
      service.stop();

      await service.startWatching(ONE_ANIME);

      expect(workerState.instances).toHaveLength(2);
      service.stop();
    });

    it('leaves isReady() true after stop, though the worker is gone', async () => {
      // FINDING (minor): `stop()` nulls the worker but never resets
      // `isWorkerReady`, so `isReady()` answers true for a service that can no
      // longer do anything. Nothing currently branches on it after a stop --
      // `triggerImmediateUpdate` also checks the worker -- so this is recorded
      // rather than worked around.
      const service = await loadRealService();
      await service.startWatching(ONE_ANIME);

      service.stop();

      expect(service.isReady()).toBe(true);
    });
  });

  describe('messages from the worker', () => {
    it('routes a notification to the notification callback', async () => {
      const service = await loadRealService();
      const onNotification = vi.fn();
      service.setNotificationCallback(onNotification);
      await service.startWatching(ONE_ANIME);

      const anime = { id: 'a1', titleEn: 'Frieren' };
      const episode = { episodeNumber: 4, titleEn: 'The Land Where Souls Rest' };
      workerState.instances[0].emit('message', {
        data: { type: 'notification', notificationType: 'airing', anime, episode }
      });

      expect(onNotification).toHaveBeenCalledWith('airing', anime, episode);
      service.stop();
    });

    it('labels an unknown notification type with the raw value', async () => {
      const service = await loadRealService();
      service.setNotificationCallback(vi.fn());
      await service.startWatching(ONE_ANIME);

      workerState.instances[0].emit('message', {
        data: {
          type: 'notification',
          notificationType: 'brand-new-kind',
          anime: { id: 'a1', titleJp: 'フリーレン' }
        }
      });

      expect(mockDebug.anime).toHaveBeenCalledWith('📺 brand-new-kind: フリーレン');
      service.stop();
    });

    it('routes countdown and timing messages to their callbacks', async () => {
      const service = await loadRealService();
      const onCountdown = vi.fn();
      const onTiming = vi.fn();
      service.setCountdownCallback(onCountdown);
      service.setTimingCallback(onTiming);
      await service.startWatching(ONE_ANIME);

      workerState.instances[0].emit('message', {
        data: {
          type: 'countdown',
          animeId: 'a1',
          countdown: 'AIRING',
          isAiring: true,
          hasAired: false,
          progress: 0.4
        }
      });
      workerState.instances[0].emit('message', {
        data: { type: 'timing', animeId: 'a1', timingData: { countdown: 'AIRING' } }
      });

      expect(onCountdown).toHaveBeenCalledWith('a1', 'AIRING', true, false, 0.4);
      expect(onTiming).toHaveBeenCalledWith('a1', { countdown: 'AIRING' });
      service.stop();
    });

    it('ignores a message type it does not know', async () => {
      const service = await loadRealService();
      const onNotification = vi.fn();
      const onCountdown = vi.fn();
      const onTiming = vi.fn();
      service.setNotificationCallback(onNotification);
      service.setCountdownCallback(onCountdown);
      service.setTimingCallback(onTiming);
      await service.startWatching(ONE_ANIME);

      workerState.instances[0].emit('message', { data: { type: 'something-else' } });

      expect(onNotification).not.toHaveBeenCalled();
      expect(onCountdown).not.toHaveBeenCalled();
      expect(onTiming).not.toHaveBeenCalled();
      service.stop();
    });

    it('drops messages harmlessly when no callback is registered', async () => {
      const service = await loadRealService();
      await service.startWatching(ONE_ANIME);

      expect(() => {
        workerState.instances[0].emit('message', {
          data: { type: 'countdown', animeId: 'a1', countdown: '5m' }
        });
        workerState.instances[0].emit('message', {
          data: { type: 'timing', animeId: 'a1', timingData: {} }
        });
        workerState.instances[0].emit('message', {
          data: { type: 'notification', notificationType: 'airing', anime: { id: 'a1' } }
        });
      }).not.toThrow();
      service.stop();
    });

    it('logs a worker error without tearing the page down', async () => {
      const service = await loadRealService();
      await service.startWatching(ONE_ANIME);

      workerState.instances[0].emit('error', { message: 'boom', filename: 'w.js', lineno: 3 });

      expect(mockDebug.error).toHaveBeenCalledWith(
        'Anime notification worker error:',
        expect.stringContaining('boom')
      );
      service.stop();
    });

    it('logs a messageerror', async () => {
      const service = await loadRealService();
      await service.startWatching(ONE_ANIME);

      workerState.instances[0].emit('messageerror', { reason: 'uncloneable' });

      expect(mockDebug.error).toHaveBeenCalledWith('Worker message error:', {
        reason: 'uncloneable'
      });
      service.stop();
    });
  });

  describe('commands to the worker', () => {
    it('forwards a dev time offset', async () => {
      const service = await loadRealService();
      await service.startWatching(ONE_ANIME);

      service.setDevTimeOffset(90 * 60 * 1000);

      expect(workerState.instances[0].postMessage).toHaveBeenCalledWith({
        type: 'setTimeOffset',
        offsetMs: 90 * 60 * 1000
      });
      service.stop();
    });

    it('triggers an immediate update once the worker is watching', async () => {
      const service = await loadRealService();
      await service.startWatching(ONE_ANIME);

      service.triggerImmediateUpdate();

      expect(workerState.instances[0].postMessage).toHaveBeenCalledWith({
        type: 'triggerUpdate'
      });
      service.stop();
    });

    it('warns instead of posting when nothing is watching yet', async () => {
      const service = await loadRealService();

      service.triggerImmediateUpdate();

      expect(mockDebug.warn).toHaveBeenCalledWith('🔔 Worker not ready for triggerUpdate', {
        hasWorker: false,
        isReady: false
      });
    });

    it('does nothing on clearAll / setDevTimeOffset before a worker exists', async () => {
      const service = await loadRealService();

      expect(() => {
        service.clearAll();
        service.setDevTimeOffset(1000);
        service.stop();
      }).not.toThrow();
      expect(workerState.instances).toHaveLength(0);
    });

    it('tells the worker to stop watching without terminating it', async () => {
      const service = await loadRealService();
      await service.startWatching(ONE_ANIME);

      service.clearAll();

      expect(workerState.instances[0].postMessage).toHaveBeenCalledWith({ type: 'stopWatching' });
      expect(workerState.instances[0].terminate).not.toHaveBeenCalled();
      service.stop();
    });
  });
});
