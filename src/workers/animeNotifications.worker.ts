// Web Worker for anime notifications and countdown calculations
// This worker runs in a separate thread to provide accurate timing

// Shared air-time logic lives in airTimeUtils; the worker imports it instead of
// keeping a copy. getCurrentTime honors the worker's devTimeOffset via globalThis
// (globalThis === self inside a worker); see airTimeUtils.getCurrentTime.
import {
  getCurrentTime,
  parseDurationToMinutes,
  parseAirTime,
  getAirDateTime,
  isAiringToday,
  isCurrentlyAiring,
  hasAlreadyAired,
  calculateCountdown,
  type NextEpisodeResult,
} from '../services/airTimeUtils';

/**
 * Get next episode data directly from anime object (using new nextEpisode structure)
 * @param anime - Anime object with nextEpisode field
 * @returns The next episode and its calculated air time, or null if none found
 */
function getNextEpisode(anime: AnimeForNotification): NextEpisodeResult | null {
  if (!anime.nextEpisode) return null;

  const nextEpisode = anime.nextEpisode;

  // Use airTime from backend if available, otherwise fall back to airDate
  let airTime: Date;
  if (nextEpisode.airTime) {
    airTime = new Date(nextEpisode.airTime);
  } else if (nextEpisode.airDate) {
    airTime = parseAirTime(nextEpisode.airDate, anime.broadcast) || new Date(nextEpisode.airDate);
  } else {
    return null;
  }

  return {
    episode: {
      id: nextEpisode.id,
      episodeNumber: nextEpisode.episodeNumber,
      titleEn: nextEpisode.titleEn,
      titleJp: nextEpisode.titleJp,
      airDate: nextEpisode.airDate
    },
    airTime
  };
}



interface AnimeForNotification {
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

interface NotificationMessage {
  type: 'notification';
  notificationType: 'warning' | 'airing' | 'airing-soon' | 'finished-airing';
  anime: AnimeForNotification;
  episode: {
    episodeNumber?: number | null;
    titleEn?: string | null;
    titleJp?: string | null;
  };
}

interface CountdownMessage {
  type: 'countdown';
  animeId: string;
  countdown: string;
  isAiring: boolean;
  hasAired: boolean;
  progress?: number; // 0-1 for airing episodes
}

interface TimingMessage {
  type: 'timing';
  animeId: string;
  timingData: {
    countdown: string;
    isAiring: boolean;
    hasAired: boolean;
    progress?: number;
    isAiringToday: boolean;
    isCurrentlyAiring: boolean;
    hasAlreadyAired: boolean;
    airDateTime: string;
    episode?: {
      episodeNumber?: number | null;
      titleEn?: string | null;
      titleJp?: string | null;
    };
  };
}

interface StartWatchingMessage {
  type: 'startWatching';
  animeList: AnimeForNotification[];
}

interface StopWatchingMessage {
  type: 'stopWatching';
}

interface SetTimeOffsetMessage {
  type: 'setTimeOffset';
  offsetMs: number;
}

interface TriggerUpdateMessage {
  type: 'triggerUpdate';
}

type WorkerMessage = StartWatchingMessage | StopWatchingMessage | SetTimeOffsetMessage | TriggerUpdateMessage;

// Worker uses shared airTimeUtils functions via imports above

// Worker state
let animeList: AnimeForNotification[] = [];
let countdownInterval: ReturnType<typeof setInterval> | null = null;
let notifiedAnime: Set<string> = new Set();

// Dev time offset for testing - store in self for shared access
(self as any).devTimeOffset = 0;

function clearAllIntervals() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

function checkNotifications() {
  animeList.forEach(anime => {
    if (!anime.nextEpisode || !anime.broadcast) return;

    const now = getCurrentTime();
    const nextEpisodeResult = getNextEpisode(anime);
    if (!nextEpisodeResult) return;

    const { episode: nextEpisode, airTime } = nextEpisodeResult;
    const timeToAir = airTime.getTime() - now.getTime();
    const durationMinutes = parseDurationToMinutes(anime.duration);
    const episodeDurationMs = (durationMinutes || 24) * 60 * 1000;

    // Only watch anime airing within the next 24 hours
    if (timeToAir > 24 * 60 * 60 * 1000 || timeToAir < -24 * 60 * 60 * 1000) {
      return;
    }

    // Check if currently airing
    if (isCurrentlyAiring(nextEpisode.airDate, anime.broadcast, durationMinutes)) {
      const notificationKey = `${anime.id}-${nextEpisode.episodeNumber ?? 'x'}-airing`;
      if (!notifiedAnime.has(notificationKey)) {
        notifiedAnime.add(notificationKey);
        postMessage({
          type: 'notification',
          notificationType: 'airing',
          anime,
          episode: {
            episodeNumber: nextEpisode.episodeNumber,
            titleEn: nextEpisode.titleEn,
            titleJp: nextEpisode.titleJp
          }
        } as NotificationMessage);
      }
      return;
    }

    // Check if finished airing (within the last 30 minutes)
    const finishedTime = timeToAir + episodeDurationMs;
    if (finishedTime < 0 && finishedTime > -(30 * 60 * 1000)) {
      const notificationKey = `${anime.id}-${nextEpisode.episodeNumber ?? 'x'}-finished`;
      if (!notifiedAnime.has(notificationKey)) {
        notifiedAnime.add(notificationKey);
        postMessage({
          type: 'notification',
          notificationType: 'finished-airing',
          anime,
          episode: {
            episodeNumber: nextEpisode.episodeNumber,
            titleEn: nextEpisode.titleEn,
            titleJp: nextEpisode.titleJp
          }
        } as NotificationMessage);
      }
      return;
    }

    // Check for 30-minute "airing soon" notification (within 5-second window)
    const airingSoonTime = timeToAir - (30 * 60 * 1000);
    if (airingSoonTime >= 0 && airingSoonTime < 5000) {
      const notificationKey = `${anime.id}-${nextEpisode.episodeNumber ?? 'x'}-airing-soon`;
      if (!notifiedAnime.has(notificationKey)) {
        notifiedAnime.add(notificationKey);
        postMessage({
          type: 'notification',
          notificationType: 'airing-soon',
          anime,
          episode: {
            episodeNumber: nextEpisode.episodeNumber,
            titleEn: nextEpisode.titleEn,
            titleJp: nextEpisode.titleJp
          }
        } as NotificationMessage);
      }
    }

    // Check for 5-minute warning (within 5-second window)
    const fiveMinuteWarning = timeToAir - (5 * 60 * 1000);
    if (fiveMinuteWarning >= 0 && fiveMinuteWarning < 5000) {
      const notificationKey = `${anime.id}-${nextEpisode.episodeNumber ?? 'x'}-warning`;
      if (!notifiedAnime.has(notificationKey)) {
        notifiedAnime.add(notificationKey);
        postMessage({
          type: 'notification',
          notificationType: 'warning',
          anime,
          episode: {
            episodeNumber: nextEpisode.episodeNumber,
            titleEn: nextEpisode.titleEn,
            titleJp: nextEpisode.titleJp
          }
        } as NotificationMessage);
      }
    }

    // Check for airing notification (within 5-second window)
    if (timeToAir >= 0 && timeToAir < 5000) {
      const notificationKey = `${anime.id}-${nextEpisode.episodeNumber ?? 'x'}-airing`;
      if (!notifiedAnime.has(notificationKey)) {
        notifiedAnime.add(notificationKey);
        postMessage({
          type: 'notification',
          notificationType: 'airing',
          anime,
          episode: {
            episodeNumber: nextEpisode.episodeNumber,
            titleEn: nextEpisode.titleEn,
            titleJp: nextEpisode.titleJp
          }
        } as NotificationMessage);
      }
    }
  });
}

function updateCountdowns() {
  // Check for notifications first
  checkNotifications();

  animeList.forEach(anime => {
    if (!anime.nextEpisode || !anime.broadcast) return;

    const now = getCurrentTime();
    const nextEpisodeResult = getNextEpisode(anime);
    if (!nextEpisodeResult) return;

    const { episode: nextEpisode, airTime } = nextEpisodeResult;
    const timeToAir = airTime.getTime() - now.getTime();

    // Only send updates for anime airing within 24 hours or recently aired (within 7 days)
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    if (timeToAir > 24 * 60 * 60 * 1000 || timeToAir < -sevenDaysMs) {
      return;
    }

    const durationMinutes = parseDurationToMinutes(anime.duration);
    const countdown = calculateCountdown(nextEpisode.airDate, anime.broadcast, durationMinutes);
    const isAiring = isCurrentlyAiring(nextEpisode.airDate, anime.broadcast, durationMinutes);
    const hasAired = timeToAir < 0;

    // Calculate progress for currently airing episodes
    let progress: number | undefined = undefined;
    if (isAiring && airTime) {
      const airStartMs = airTime.getTime();
      const currentMs = now.getTime();
      const episodeDurationMs = (durationMinutes || 24) * 60 * 1000;
      const elapsedMs = currentMs - airStartMs;
      progress = Math.min(Math.max(elapsedMs / episodeDurationMs, 0), 1);
    }

    // Calculate all timing states
    const airingToday = isAiringToday(nextEpisode.airDate, anime.broadcast);
    const currentlyAiring = isAiring;
    const alreadyAired = hasAlreadyAired(nextEpisode.airDate, anime.broadcast, durationMinutes);
    const airDateTime = getAirDateTime(nextEpisode.airDate, anime.broadcast);

    // Send backward compatible countdown message
    postMessage({
      type: 'countdown',
      animeId: anime.id,
      countdown,
      isAiring,
      hasAired,
      progress
    } as CountdownMessage);

    // Send comprehensive timing data
    postMessage({
      type: 'timing',
      animeId: anime.id,
      timingData: {
        countdown,
        isAiring,
        hasAired,
        progress,
        isAiringToday: airingToday,
        isCurrentlyAiring: currentlyAiring,
        hasAlreadyAired: alreadyAired,
        airDateTime,
        episode: {
          episodeNumber: nextEpisode.episodeNumber,
          titleEn: nextEpisode.titleEn,
          titleJp: nextEpisode.titleJp
        }
      }
    } as TimingMessage);
  });
}

function startCountdownUpdates() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }

  // Update countdowns every 5 seconds
  countdownInterval = setInterval(updateCountdowns, 5000);
}

// Listen for messages from main thread
self.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
  const { type } = event.data;

  switch (type) {
    case 'startWatching':
      animeList = event.data.animeList;
      clearAllIntervals();
      notifiedAnime.clear();

      // Start countdown updates
      startCountdownUpdates();

      console.log(`[AnimeWorker] Started watching ${animeList.length} anime`);
      break;

    case 'stopWatching':
      clearAllIntervals();
      animeList = [];
      notifiedAnime.clear();
      console.log('[AnimeWorker] Stopped watching anime');
      break;

    case 'setTimeOffset':
      (self as any).devTimeOffset = event.data.offsetMs;
      console.log('[AnimeWorker] Dev time offset set to:', event.data.offsetMs, 'ms');
      break;

    case 'triggerUpdate':
      console.log('[AnimeWorker] Triggering immediate update');
      updateCountdowns();
      break;

    default:
      console.warn('[AnimeWorker] Unknown message type:', type);
  }
});

