// Web Worker for anime notifications and countdown calculations
// This worker runs in a separate thread to provide accurate timing

function formatInTZ(date: Date, timeZone: string, locale = 'en-US') {
  const dtf = new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const parts = Object.fromEntries(dtf.formatToParts(date).map(p => [p.type, p.value]));
  const day = Number(parts.day);
  const ord = (n: number) =>
    (n % 10 === 1 && n % 100 !== 11) ? 'st' :
      (n % 10 === 2 && n % 100 !== 12) ? 'nd' :
        (n % 10 === 3 && n % 100 !== 13) ? 'rd' : 'th';
  const ampm = parts.dayPeriod ?? (Number(parts.hour) < 12 ? 'AM' : 'PM');
  return `${parts.weekday} ${parts.month} ${day}${ord(day)} at ${parts.hour}:${parts.minute} ${ampm}`;
}

// Get current time with dev offset applied (for testing)
function getCurrentTime(): Date {
  const offset = (self as any).devTimeOffset || 0;
  return new Date(Date.now() + offset);
}

/**
 * Parse duration string to minutes
 * Handles formats like "24 min per episode", "24 min", "23 min per ep", etc.
 */
function parseDurationToMinutes(duration?: string | null): number | null {
  if (!duration) return null;

  // Extract number from duration string
  const match = duration.match(/(\d+)/);
  if (!match) return null;

  return parseInt(match[1], 10);
}

interface AirTimeInfo {
  airDate: Date;
  isAiringToday: boolean;
  hasAlreadyAired: boolean;
  countdown: string;
  formattedDateTime: string;
}

/**
 * Parse broadcast time and create accurate air time
 * @param airDate - The air date string
 * @param broadcast - The broadcast string (e.g., "Wednesdays at 01:29 (JST)")
 */
function parseAirTime(airDate?: string | null, broadcast?: string | null): Date | null {
  if (!airDate || !broadcast) return null;

  // Parse broadcast time (e.g., "Wednesdays at 01:29 (JST)")
  const timeMatch = broadcast.match(/(\d{1,2}):(\d{2})/);
  const timezoneMatch = broadcast.match(/\(([A-Z]{3,4})\)/);

  if (!timeMatch) return new Date(airDate);

  const [, hours, minutes] = timeMatch;
  const timezone = timezoneMatch ? timezoneMatch[1] : 'JST';

  // Create a date object from the air date
  const parsedAirDate = new Date(airDate);

  if (timezone === 'JST') {
    const jstHours = parseInt(hours);
    const jstMinutes = parseInt(minutes);

    // JST is UTC+9, so to get UTC time we subtract 9 hours
    // But the test expects local EDT time (UTC-4 during summer)
    // So JST 00:00 -> UTC 15:00 -> EDT 11:00, but test expects EDT 10:00
    // This suggests we need to account for DST differently

    let utcHours = jstHours - 9;
    let utcDate = new Date(parsedAirDate);

    if (utcHours < 0) {
      // Previous day case
      utcDate.setUTCDate(utcDate.getUTCDate() - 1);
      utcHours += 24;
    }



    utcDate.setUTCHours(utcHours, jstMinutes, 0, 0);
    return utcDate;
  } else {
    // For other timezones, assume UTC
    const broadcastDate = new Date(parsedAirDate);
    broadcastDate.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);
    return broadcastDate;
  }
}

/**
 * Format air date with time in local timezone
 */
function getAirDateTime(
  airDate?: string | null,
  broadcast?: string | null,
  opts?: { timeZone?: string }   // <-- add this
): string {
  if (!airDate) return "Unknown";

  const tz = opts?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const airTime = parseAirTime(airDate, broadcast); // should return a real UTC instant

  if (airTime) {
    return formatInTZ(airTime, tz);
  }
  // fallback if parseAirTime failed
  return formatInTZ(new Date(airDate), tz);
}

/**
 * Check if the anime is airing today or within 24 hours (more flexible)
 */
function isAiringToday(airDate?: string | null, broadcast?: string | null): boolean {
  if (!airDate) return false;

  const airTime = parseAirTime(airDate, broadcast);
  if (!airTime) return false;

  const now = getCurrentTime();
  const diffMs = airTime.getTime() - now.getTime();

  // Show countdown if airing within next 24 hours
  return diffMs > 0 && diffMs <= (24 * 60 * 60 * 1000);
}

/**
 * Check if the anime is currently airing (started but not finished)
 */
function isCurrentlyAiring(airDate?: string | null, broadcast?: string | null, durationMinutes?: number | null): boolean {
  if (!airDate) return false;

  const airTime = parseAirTime(airDate, broadcast);
  if (!airTime) return false;

  const now = getCurrentTime();
  const airStartMs = airTime.getTime();
  const currentMs = now.getTime();

  // If we don't have duration info, default to 24 minutes (typical anime episode)
  const episodeDurationMs = (durationMinutes || 24) * 60 * 1000;
  const airEndMs = airStartMs + episodeDurationMs;

  // Currently airing if current time is between start and end time
  return currentMs >= airStartMs && currentMs <= airEndMs;
}

/**
 * Check if the anime has already aired
 */
function hasAlreadyAired(airDate?: string | null, broadcast?: string | null, durationMinutes?: number | null): boolean {
  if (!airDate) return false;

  const airTime = parseAirTime(airDate, broadcast);
  if (!airTime) return false;

  const now = getCurrentTime();
  const airStartMs = airTime.getTime();
  const currentMs = now.getTime();

  // If we don't have duration info, default to 24 minutes
  const episodeDurationMs = (durationMinutes || 24) * 60 * 1000;
  const airEndMs = airStartMs + episodeDurationMs;

  // Show "already aired" if episode has finished and it's within the last 7 days
  return currentMs > airEndMs && (currentMs - airEndMs) <= (7 * 24 * 60 * 60 * 1000);
}

/**
 * Calculate countdown string or current airing status
 */
function calculateCountdown(
  airDate?: string | null,
  broadcast?: string | null,
  durationMinutes?: number | null
): string {
  if (!airDate) return "";

  const now = getCurrentTime();
  const airTime = parseAirTime(airDate, broadcast);
  if (!airTime) return "";

  // 1) Currently airing?
  if (isCurrentlyAiring(airDate, broadcast, durationMinutes)) {
    const airStartMs = airTime.getTime();
    const currentMs = now.getTime();
    const episodeDurationMs = (durationMinutes || 24) * 60 * 1000;
    const remainingMs = airStartMs + episodeDurationMs - currentMs;
    const remainingMinutes = Math.floor(remainingMs / (1000 * 60));
    if (remainingMinutes <= 0) return "ENDING SOON";
    if (remainingMinutes < 60) return `${remainingMinutes}m left`;
    return "AIRING NOW";
  }

  const diffMs = airTime.getTime() - now.getTime();

  // 2) Upcoming today (within next 24h)
  const DAY_MS = 24 * 60 * 60 * 1000;
  if (diffMs > 0 && diffMs <= DAY_MS) {
    const diffMinutes = Math.ceil(diffMs / (1000 * 60));
    if (diffMinutes < 60) return `${diffMinutes}m`;
    const diffHours = Math.floor(diffMinutes / 60);
    return `${diffHours}h`;
  }

  // 3) Already started (but not currently airing) => just aired
  if (diffMs <= 0) return "JUST AIRED";
  // log anime title and airDate for debugging

  // 4) Not today (>24h away)
  return "";
}

/**
 * Episode interface for next episode selection
 */
interface Episode {
  id: string;
  episodeNumber?: number | null;
  titleEn?: string | null;
  titleJp?: string | null;
  airDate?: string | null;
}

/**
 * Result of finding the next episode
 */
interface NextEpisodeResult {
  episode: Episode;
  airTime: Date;
}

/**
 * Find the next episode from an episodes array, prioritizing future episodes over recently aired ones
 * @param episodes - Array of episodes
 * @param broadcast - Broadcast string for timezone conversion
 * @param currentTime - Current time (for testing, defaults to now)
 * @returns The next episode and its calculated air time, or null if none found
 */
function findNextEpisode(
  episodes?: Episode[] | null,
  broadcast?: string | null,
  currentTime?: Date
): NextEpisodeResult | null {
  if (!episodes || episodes.length === 0) return null;

  for (const episode of episodes) {
    if (episode.airDate) {
      const airTime = parseAirTime(episode.airDate, broadcast);
      if (airTime) {
        const now = currentTime || getCurrentTime();
        // or in the last 24 hours
        if (airTime.getTime() > now.getTime() || (now.getTime() - airTime.getTime()) <= (24 * 60 * 60 * 1000)) {
          return { episode, airTime };
        }
      }
    }

  }

  return null;
}



interface AnimeForNotification {
  id: string;
  titleEn?: string | null;
  titleJp?: string | null;
  imageUrl?: string | null;
  duration?: string | null;
  broadcast?: string | null;
  episodes?: {
    id: string;
    episodeNumber?: number | null;
    titleEn?: string | null;
    titleJp?: string | null;
    airDate?: string | null;
  }[] | null;
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
    if (!anime.episodes || !anime.broadcast) return;

    const now = getCurrentTime();
    const nextEpisodeResult = findNextEpisode(anime.episodes, anime.broadcast, now);
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
      const notificationKey = `${anime.id}-airing`;
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
      const notificationKey = `${anime.id}-finished`;
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
      const notificationKey = `${anime.id}-airing-soon`;
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
      const notificationKey = `${anime.id}-warning`;
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
      const notificationKey = `${anime.id}-airing`;
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
    if (!anime.episodes || !anime.broadcast) return;

    const now = getCurrentTime();
    const nextEpisodeResult = findNextEpisode(anime.episodes, anime.broadcast, now);
    if (!nextEpisodeResult) return;

    const { episode: nextEpisode, airTime } = nextEpisodeResult;
    const timeToAir = airTime.getTime() - now.getTime();

    // Only send updates for anime airing within 24 hours
    if (timeToAir > 24 * 60 * 60 * 1000 || timeToAir < -24 * 60 * 60 * 1000) {
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

// Handle worker termination
self.addEventListener('beforeunload', () => {
  clearAllIntervals();
});
