import React from 'react';
import {format} from 'date-fns';
import {formatInTimeZone} from 'date-fns-tz';

// Get current time with dev offset applied (for testing)
export function getCurrentTime(): Date {
  const now = new Date();


  return now;
}






/**
 * Parse duration string to minutes
 * Handles formats like "24 min per episode", "24 min", "23 min per ep", etc.
 */
export function parseDurationToMinutes(duration?: string | null): number | null {
  if (!duration) return null;

  // Extract number from duration string
  const match = duration.match(/(\d+)/);
  if (!match) return null;

  return parseInt(match[1], 10);
}

export interface AirTimeInfo {
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
export function parseAirTime(airDate?: string | null, broadcast?: string | null): Date | null {
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
export function getAirDateTime(
  airDate?: string | null,
  broadcast?: string | null,
  opts?: { timeZone?: string }   // <-- add this
): string {
  if (!airDate) return "Unknown";

  const tz = opts?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const airTime = parseAirTime(airDate, broadcast); // should return a real UTC instant

  if (airTime) {
    return formatInTimeZone(airTime, tz, "EEE MMM do 'at' h:mm a");
  }
  // fallback if parseAirTime failed
  return formatInTimeZone(new Date(airDate), tz, "EEE MMM do");
}

/**
 * Check if the anime is airing today or within 24 hours (more flexible)
 */
export function isAiringToday(airDate?: string | null, broadcast?: string | null): boolean {
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
export function isCurrentlyAiring(airDate?: string | null, broadcast?: string | null, durationMinutes?: number | null): boolean {
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
export function hasAlreadyAired(airDate?: string | null, broadcast?: string | null, durationMinutes?: number | null): boolean {
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
export function calculateCountdown(
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

  // 4) Not today (>24h away)
  return "";
}


/**
 * Get comprehensive air time information for an anime
 */
export function getAirTimeInfo(airDate?: string | null, broadcast?: string | null, durationMinutes?: number | null): AirTimeInfo | null {
  if (!airDate) return null;

  const parsedAirTime = parseAirTime(airDate, broadcast);
  if (!parsedAirTime) return null;

  return {
    airDate: parsedAirTime,
    isAiringToday: isAiringToday(airDate, broadcast),
    hasAlreadyAired: hasAlreadyAired(airDate, broadcast, durationMinutes),
    countdown: calculateCountdown(airDate, broadcast, durationMinutes),
    formattedDateTime: getAirDateTime(airDate, broadcast)
  };
}

/**
 * Episode interface for next episode selection
 */
export interface Episode {
  id: string;
  episodeNumber?: number | null;
  titleEn?: string | null;
  titleJp?: string | null;
  airDate?: string | null;
}

/**
 * Result of finding the next episode
 */
export interface NextEpisodeResult {
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
export function findNextEpisode(
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

/**
 * Get air time display configuration for AnimeCard component
 */
export function getAirTimeDisplay(airDate?: string | null, broadcast?: string | null, durationMinutes?: number | null, now?: Date | null): {
  show: boolean;
  text: string;
  variant?: 'countdown' | 'scheduled' | 'aired' | 'airing';
  icon?: React.ReactNode;
} | null {

  const airInfo = getAirTimeInfo(airDate, broadcast, durationMinutes);
  if (!airInfo) return null;

  // Check if currently airing first
  if (isCurrentlyAiring(airDate, broadcast, durationMinutes)) {
    return {
      show: true,
      text: airInfo.countdown.includes("left") ? `Currently airing (${airInfo.countdown})` : "Currently airing",
      variant: 'airing' as const
    };
  }

  if (airInfo.isAiringToday && airInfo.countdown) {
    const isJustAired = airInfo.countdown === "JUST AIRED";
    return {
      show: true,
      text: isJustAired ? "Just aired" : airInfo.countdown.includes("AIRING NOW") ? "Airing now" : `Airing in ${airInfo.countdown}`,
      variant: isJustAired ? 'aired' as const : 'countdown' as const
    };
  }

  if (airInfo.hasAlreadyAired) {
    return {
      show: true,
      text: "Recently aired",
      variant: 'aired' as const
    };
  }

  // For scheduled episodes, show shorter format for cards
  const shortDateTime = airInfo.airDate ? `${format(airInfo.airDate, "EEE")} at ${format(airInfo.airDate, "h:mm a")}` : airInfo.formattedDateTime;

  return {
    show: true,
    text: `Airing ${shortDateTime}`,
    variant: 'scheduled' as const
  };
}
