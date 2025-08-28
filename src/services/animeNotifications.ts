import { parseAirTime, parseDurationToMinutes, isCurrentlyAiring } from './airTimeUtils';
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

class AnimeNotificationService {
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private notifiedAnime: Set<string> = new Set();
  private callback?: NotificationCallback;

  setNotificationCallback(callback: NotificationCallback) {
    this.callback = callback;
  }

  startWatching(animeList: AnimeForNotification[]) {
    // Clear existing intervals
    this.clearAll();

    debug.info('Starting anime notification watching for', animeList.length, 'anime');

    animeList.forEach(anime => {
      if (!anime.nextEpisode?.airDate || !anime.broadcast) {
        return;
      }

      const airTime = parseAirTime(anime.nextEpisode.airDate, anime.broadcast);
      if (!airTime) return;

      const now = new Date();
      const timeToAir = airTime.getTime() - now.getTime();
      const durationMinutes = parseDurationToMinutes(anime.duration);

      // Only watch anime airing within the next 24 hours
      if (timeToAir > 24 * 60 * 60 * 1000 || timeToAir < -24 * 60 * 60 * 1000) {
        return;
      }

      // Check if currently airing
      if (isCurrentlyAiring(anime.nextEpisode.airDate, anime.broadcast, durationMinutes)) {
        this.handleCurrentlyAiring(anime);
        return;
      }

      // Set up 5-minute warning
      const fiveMinuteWarning = timeToAir - (5 * 60 * 1000); // 5 minutes before
      if (fiveMinuteWarning > 0 && fiveMinuteWarning < 24 * 60 * 60 * 1000) {
        const warningTimeout = setTimeout(() => {
          this.handleFiveMinuteWarning(anime);
        }, fiveMinuteWarning);

        this.intervals.set(`${anime.id}-warning`, warningTimeout);
        debug.info(`Set 5-minute warning for ${anime.titleEn || anime.titleJp} in ${Math.round(fiveMinuteWarning / 1000 / 60)} minutes`);
      }

      // Set up airing notification
      if (timeToAir > 0 && timeToAir < 24 * 60 * 60 * 1000) {
        const airingTimeout = setTimeout(() => {
          this.handleNowAiring(anime);
        }, timeToAir);

        this.intervals.set(`${anime.id}-airing`, airingTimeout);
        debug.info(`Set airing notification for ${anime.titleEn || anime.titleJp} in ${Math.round(timeToAir / 1000 / 60)} minutes`);
      }
    });
  }

  private handleFiveMinuteWarning(anime: AnimeForNotification) {
    const notificationKey = `${anime.id}-warning`;
    
    if (this.notifiedAnime.has(notificationKey)) {
      return;
    }

    this.notifiedAnime.add(notificationKey);
    debug.anime('5-minute warning for', anime.titleEn || anime.titleJp);

    if (this.callback) {
      this.callback('warning', anime);
    }
  }

  private handleNowAiring(anime: AnimeForNotification) {
    const notificationKey = `${anime.id}-airing`;
    
    if (this.notifiedAnime.has(notificationKey)) {
      return;
    }

    this.notifiedAnime.add(notificationKey);
    debug.anime('Now airing:', anime.titleEn || anime.titleJp);

    if (this.callback) {
      this.callback('airing', anime);
    }
  }

  private handleCurrentlyAiring(anime: AnimeForNotification) {
    // For anime that are already airing when we start watching
    const notificationKey = `${anime.id}-airing`;
    
    if (this.notifiedAnime.has(notificationKey)) {
      return;
    }

    this.notifiedAnime.add(notificationKey);
    debug.anime('Currently airing:', anime.titleEn || anime.titleJp);

    if (this.callback) {
      this.callback('airing', anime);
    }
  }

  clearAll() {
    this.intervals.forEach(interval => {
      clearTimeout(interval);
    });
    this.intervals.clear();
    
    // Keep notification history to avoid duplicates until cleared
    // this.notifiedAnime.clear(); - Don't clear to avoid duplicate notifications
  }

  clearNotificationHistory() {
    this.notifiedAnime.clear();
  }

  stop() {
    this.clearAll();
    this.clearNotificationHistory();
  }
}

// Export a singleton instance
export const animeNotificationService = new AnimeNotificationService();