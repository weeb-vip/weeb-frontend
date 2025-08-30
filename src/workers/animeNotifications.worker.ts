// Web Worker for anime notifications and countdown calculations
// This worker runs in a separate thread to provide accurate timing
// Self-contained with no external dependencies to avoid window references


interface AnimeForNotification {
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

interface NotificationMessage {
  type: 'notification';
  notificationType: 'warning' | 'airing' | 'airing-soon' | 'finished-airing';
  anime: AnimeForNotification;
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
type WorkerResponse = NotificationMessage | CountdownMessage | TimingMessage;

// Air time utilities (self-contained, no external imports)
function parseDurationToMinutes(duration?: string | null): number | null {
  if (!duration) return null;
  const match = duration.match(/(\d+)/);
  if (!match) return null;
  return parseInt(match[1], 10);
}

function parseAirTime(airDate?: string | null, broadcast?: string | null): Date | null {
  if (!airDate || !broadcast) return null;

  const timeMatch = broadcast.match(/(\d{1,2}):(\d{2})/);
  const timezoneMatch = broadcast.match(/\(([A-Z]{3,4})\)/);

  if (!timeMatch) return new Date(airDate);

  const [, hours, minutes] = timeMatch;
  const timezone = timezoneMatch ? timezoneMatch[1] : 'JST';
  const parsedAirDate = new Date(airDate);

  if (timezone === 'JST') {
    const jstHours = parseInt(hours);
    const jstMinutes = parseInt(minutes);

    let utcHours = jstHours - 9;
    let utcDate = new Date(parsedAirDate);

    if (utcHours < 0) {
      utcDate.setUTCDate(utcDate.getUTCDate() - 1);
      utcHours += 24;
    }

    utcHours -= 1;
    if (utcHours < 0) {
      utcDate.setUTCDate(utcDate.getUTCDate() - 1);
      utcHours += 24;
    }

    utcDate.setUTCHours(utcHours, jstMinutes, 0, 0);
    return utcDate;
  } else {
    const broadcastDate = new Date(parsedAirDate);
    broadcastDate.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);
    return broadcastDate;
  }
}

function isCurrentlyAiring(airDate?: string | null, broadcast?: string | null, durationMinutes?: number | null): boolean {
  if (!airDate) return false;

  const airTime = parseAirTime(airDate, broadcast);
  if (!airTime) return false;

  const now = getCurrentTime();
  const airStartMs = airTime.getTime();
  const currentMs = now.getTime();
  const episodeDurationMs = (durationMinutes || 24) * 60 * 1000;
  const airEndMs = airStartMs + episodeDurationMs;

  return currentMs >= airStartMs && currentMs <= airEndMs;
}

function calculateCountdown(airDate?: string | null, broadcast?: string | null, durationMinutes?: number | null): string {
  if (!airDate) return "";

  const now = getCurrentTime();
  const airTime = parseAirTime(airDate, broadcast);
  if (!airTime) return "";

  if (isCurrentlyAiring(airDate, broadcast, durationMinutes)) {
    const airStartMs = airTime.getTime();
    const currentMs = now.getTime();
    const episodeDurationMs = (durationMinutes || 24) * 60 * 1000;
    const airEndMs = airStartMs + episodeDurationMs;
    const remainingMs = airEndMs - currentMs;
    const remainingMinutes = Math.floor(remainingMs / (1000 * 60));

    if (remainingMinutes <= 0) {
      return "ENDING SOON";
    } else if (remainingMinutes < 60) {
      return `${remainingMinutes}m left`;
    } else {
      return "AIRING NOW";
    }
  }

  const diffMs = airTime.getTime() - now.getTime();
  if (diffMs <= 0) return "JUST AIRED";

  const diffMinutes = Math.ceil(diffMs / (1000 * 60));
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));

  if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  } else if (diffHours < 24) {
    return `${diffHours}h`;
  }

  return "";
}

// Additional timing utility functions
function isAiringToday(airDate?: string | null, broadcast?: string | null): boolean {
  if (!airDate) return false;

  const airTime = parseAirTime(airDate, broadcast);
  if (!airTime) return false;

  const now = getCurrentTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const airDay = new Date(airTime.getFullYear(), airTime.getMonth(), airTime.getDate());

  return today.getTime() === airDay.getTime();
}

function hasAlreadyAired(airDate?: string | null, broadcast?: string | null, durationMinutes?: number | null): boolean {
  if (!airDate) return false;

  const airTime = parseAirTime(airDate, broadcast);
  if (!airTime) return false;

  const now = getCurrentTime();
  const episodeDurationMs = (durationMinutes || 24) * 60 * 1000;
  const airEndMs = airTime.getTime() + episodeDurationMs;

  return now.getTime() > airEndMs;
}

function getAirDateTime(airDate?: string | null, broadcast?: string | null): string {
  if (!airDate) return '';

  const airTime = parseAirTime(airDate, broadcast);
  if (!airTime) return '';

  // Format similar to the main app
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  };

  return airTime.toLocaleDateString('en-US', options);
}

// Worker state
let animeList: AnimeForNotification[] = [];
let countdownInterval: ReturnType<typeof setInterval> | null = null;
let notifiedAnime: Set<string> = new Set();

// Dev time offset for testing
let devTimeOffset = 0;

function getCurrentTime(): Date {
  const now = new Date();

  if (devTimeOffset !== 0) {
    return new Date(now.getTime() + devTimeOffset);
  }

  return now;
}

function clearAllIntervals() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

function checkNotifications() {
  animeList.forEach(anime => {
    if (!anime.nextEpisode?.airDate || !anime.broadcast) return;

    const airTime = parseAirTime(anime.nextEpisode.airDate, anime.broadcast);
    if (!airTime) return;

    const now = getCurrentTime();
    const timeToAir = airTime.getTime() - now.getTime();
    const durationMinutes = parseDurationToMinutes(anime.duration);
    const episodeDurationMs = (durationMinutes || 24) * 60 * 1000;

    // Only watch anime airing within the next 24 hours
    if (timeToAir > 24 * 60 * 60 * 1000 || timeToAir < -24 * 60 * 60 * 1000) {
      return;
    }

    // Check if currently airing
    if (isCurrentlyAiring(anime.nextEpisode.airDate, anime.broadcast, durationMinutes)) {
      const notificationKey = `${anime.id}-airing`;
      if (!notifiedAnime.has(notificationKey)) {
        notifiedAnime.add(notificationKey);
        postMessage({
          type: 'notification',
          notificationType: 'airing',
          anime
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
          anime
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
          anime
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
          anime
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
          anime
        } as NotificationMessage);
      }
    }
  });
}

function updateCountdowns() {
  // Check for notifications first
  checkNotifications();

  animeList.forEach(anime => {
    if (!anime.nextEpisode?.airDate || !anime.broadcast) return;

    const airTime = parseAirTime(anime.nextEpisode.airDate, anime.broadcast);
    if (!airTime) return;

    const now = getCurrentTime();
    const timeToAir = airTime.getTime() - now.getTime();

    // Only send updates for anime airing within 24 hours
    if (timeToAir > 24 * 60 * 60 * 1000 || timeToAir < -24 * 60 * 60 * 1000) {
      return;
    }

    const durationMinutes = parseDurationToMinutes(anime.duration);
    const countdown = calculateCountdown(anime.nextEpisode.airDate, anime.broadcast, durationMinutes);
    const isAiring = isCurrentlyAiring(anime.nextEpisode.airDate, anime.broadcast, durationMinutes);
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
    const airingToday = isAiringToday(anime.nextEpisode.airDate, anime.broadcast);
    const currentlyAiring = isAiring;
    const alreadyAired = hasAlreadyAired(anime.nextEpisode.airDate, anime.broadcast, durationMinutes);
    const airDateTime = getAirDateTime(anime.nextEpisode.airDate, anime.broadcast);

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
        airDateTime
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
      devTimeOffset = event.data.offsetMs;
      console.log('[AnimeWorker] Dev time offset set to:', devTimeOffset, 'ms');
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
