import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AnimeForNotification } from './animeNotifications';

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
 * double. Everything driven below is the real singleton from
 * `./animeNotifications`.
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

/**
 * The real singleton is the only thing tested below. A hand-written
 * `TestableAnimeNotificationService` copy used to sit here and re-implement the
 * service so it could be driven; a copy cannot catch a change to the module it
 * mirrors, so it was removed and the assertions worth keeping moved onto the
 * real one.
 */

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

    it('reports itself not ready once it has been stopped', async () => {
      // `stop()` terminates the worker, so the readiness flag it describes has
      // to go with it: a service that can no longer do anything must not answer
      // isReady() true.
      const service = await loadRealService();
      await service.startWatching(ONE_ANIME);
      expect(service.isReady()).toBe(true);

      service.stop();

      expect(service.isReady()).toBe(false);
    });

    it('is ready again after a stop and a fresh startWatching', async () => {
      const service = await loadRealService();
      await service.startWatching(ONE_ANIME);
      service.stop();

      await service.startWatching(ONE_ANIME);

      expect(service.isReady()).toBe(true);
      service.stop();
    });

    it('warns instead of posting a triggerUpdate after a stop', async () => {
      const service = await loadRealService();
      await service.startWatching(ONE_ANIME);
      const worker = workerState.instances[0];
      service.stop();
      worker.postMessage.mockClear();

      service.triggerImmediateUpdate();

      expect(worker.postMessage).not.toHaveBeenCalled();
      expect(mockDebug.warn).toHaveBeenCalledWith('🔔 Worker not ready for triggerUpdate', {
        hasWorker: false,
        isReady: false
      });
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

    it('carries each notification kind through in the order it arrived', async () => {
      const service = await loadRealService();
      const onNotification = vi.fn();
      service.setNotificationCallback(onNotification);
      await service.startWatching(ONE_ANIME);

      const first = { id: 'a1', titleEn: 'Frieren' };
      const second = { id: 'a2', titleEn: 'Dandadan' };
      workerState.instances[0].emit('message', {
        data: {
          type: 'notification',
          notificationType: 'airing-soon',
          anime: first,
          episode: { episodeNumber: 1, titleEn: 'Episode 1' }
        }
      });
      workerState.instances[0].emit('message', {
        data: {
          type: 'notification',
          notificationType: 'finished-airing',
          anime: second,
          episode: { episodeNumber: 2, titleEn: 'Episode 2' }
        }
      });

      expect(onNotification).toHaveBeenCalledTimes(2);
      expect(onNotification).toHaveBeenNthCalledWith(1, 'airing-soon', first, {
        episodeNumber: 1,
        titleEn: 'Episode 1'
      });
      expect(onNotification).toHaveBeenNthCalledWith(2, 'finished-airing', second, {
        episodeNumber: 2,
        titleEn: 'Episode 2'
      });
      service.stop();
    });

    it('passes an absent progress through as undefined rather than inventing one', async () => {
      const service = await loadRealService();
      const onCountdown = vi.fn();
      service.setCountdownCallback(onCountdown);
      await service.startWatching(ONE_ANIME);

      workerState.instances[0].emit('message', {
        data: { type: 'countdown', animeId: 'a1', countdown: '5m', isAiring: false, hasAired: false }
      });

      expect(onCountdown).toHaveBeenCalledWith('a1', '5m', false, false, undefined);
      service.stop();
    });

    it('keeps two anime apart when both report at the same moment', async () => {
      // Two shows airing in the same slot are two rows on the page and two
      // toasts, so each has to reach the callbacks under its own id.
      const service = await loadRealService();
      const onCountdown = vi.fn();
      const onTiming = vi.fn();
      service.setCountdownCallback(onCountdown);
      service.setTimingCallback(onTiming);
      await service.startWatching(ONE_ANIME);

      for (const animeId of ['attack-titan', 'demon-slayer']) {
        workerState.instances[0].emit('message', {
          data: { type: 'countdown', animeId, countdown: '5m', isAiring: false, hasAired: false }
        });
        workerState.instances[0].emit('message', {
          data: { type: 'timing', animeId, timingData: { countdown: '5m' } }
        });
      }

      expect(onCountdown).toHaveBeenCalledTimes(2);
      expect(onCountdown).toHaveBeenCalledWith('attack-titan', '5m', false, false, undefined);
      expect(onCountdown).toHaveBeenCalledWith('demon-slayer', '5m', false, false, undefined);
      expect(onTiming).toHaveBeenCalledTimes(2);
      expect(onTiming).toHaveBeenCalledWith('attack-titan', { countdown: '5m' });
      expect(onTiming).toHaveBeenCalledWith('demon-slayer', { countdown: '5m' });
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
