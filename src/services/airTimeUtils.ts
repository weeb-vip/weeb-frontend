import {format} from 'date-fns';

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

  const parsedAirDate = new Date(airDate);

  // Parse broadcast time (e.g., "Wednesdays at 01:29 (JST)")
  const timeMatch = broadcast.match(/(\d{1,2}):(\d{2})/);
  const timezoneMatch = broadcast.match(/\(([A-Z]{3,4})\)/);

  if (!timeMatch) return parsedAirDate;

  const [, hours, minutes] = timeMatch;
  const timezone = timezoneMatch ? timezoneMatch[1] : 'JST';

  // Create a new date with the broadcast time in JST, then convert to UTC
  const broadcastDate = new Date(parsedAirDate);

  if (timezone === 'JST') {
    // JST is UTC+9, so to convert JST time to UTC, we subtract 9 hours
    broadcastDate.setUTCHours(parseInt(hours) - 9, parseInt(minutes), 0, 0);

    // Handle negative hours (previous day)
    if (parseInt(hours) - 9 < 0) {
      broadcastDate.setUTCDate(broadcastDate.getUTCDate() - 1);
      broadcastDate.setUTCHours(parseInt(hours) - 9 + 24, parseInt(minutes), 0, 0);
    }
  } else {
    broadcastDate.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);
  }

  return broadcastDate;
}

/**
 * Format air date with time in local timezone
 */
export function getAirDateTime(airDate?: string | null, broadcast?: string | null): string {
  if (!airDate) return "Unknown";

  const airTime = parseAirTime(airDate, broadcast);
  if (airTime) {
    // Use the parsed air time for both date and time (properly converted from JST to local)
    const localDate = format(airTime, "EEE MMM do");
    const localTime = format(airTime, "h:mm a");
    return `${localDate} at ${localTime}`;
  }

  // Fallback to just the original air date
  return format(new Date(airDate), "EEE MMM do");
}

/**
 * Check if the anime is airing today or within 24 hours (more flexible)
 */
export function isAiringToday(airDate?: string | null, broadcast?: string | null): boolean {
  if (!airDate) return false;

  const airTime = parseAirTime(airDate, broadcast);
  if (!airTime) return false;

  const now = new Date();
  const diffMs = airTime.getTime() - now.getTime();

  // Show countdown if airing within next 24 hours
  return diffMs > 0 && diffMs <= (24 * 60 * 60 * 1000);
}

/**
 * Check if the anime has already aired
 */
export function hasAlreadyAired(airDate?: string | null, broadcast?: string | null): boolean {
  if (!airDate) return false;

  const airTime = parseAirTime(airDate, broadcast);
  if (!airTime) return false;

  const now = new Date();
  const diffMs = airTime.getTime() - now.getTime();

  // Show "already aired" if it aired within the last 7 days
  return diffMs <= 0 && Math.abs(diffMs) <= (7 * 24 * 60 * 60 * 1000);
}

/**
 * Calculate countdown string
 */
export function calculateCountdown(airDate?: string | null, broadcast?: string | null): string {
  if (!airDate || !isAiringToday(airDate, broadcast)) return "";

  const now = new Date();
  const airTime = parseAirTime(airDate, broadcast);
  if (!airTime) return "";

  const diffMs = airTime.getTime() - now.getTime();

  if (diffMs <= 0) {
    return "AIRING NOW";
  }

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  } else if (diffHours < 24) {
    return `${diffHours}h`;
  } else if (diffDays < 30) {
    return `${diffDays}d`;
  } else {
    return "";
  }
}

/**
 * Get comprehensive air time information for an anime
 */
export function getAirTimeInfo(airDate?: string | null, broadcast?: string | null): AirTimeInfo | null {
  if (!airDate) return null;

  const parsedAirTime = parseAirTime(airDate, broadcast);
  if (!parsedAirTime) return null;

  return {
    airDate: parsedAirTime,
    isAiringToday: isAiringToday(airDate, broadcast),
    hasAlreadyAired: hasAlreadyAired(airDate, broadcast),
    countdown: calculateCountdown(airDate, broadcast),
    formattedDateTime: getAirDateTime(airDate, broadcast)
  };
}

/**
 * Get air time display configuration for AnimeCard component
 */
export function getAirTimeDisplay(airDate?: string | null, broadcast?: string | null) {
  const airInfo = getAirTimeInfo(airDate, broadcast);
  if (!airInfo) return null;

  if (airInfo.isAiringToday && airInfo.countdown) {
    return {
      show: true,
      text: airInfo.countdown === "AIRING NOW" ? "Airing now" : `Airing in ${airInfo.countdown}`,
      variant: 'countdown' as const
    };
  }

  if (airInfo.hasAlreadyAired) {
    return {
      show: true,
      text: "Recently aired",
      variant: 'aired' as const
    };
  }

  return {
    show: true,
    text: `Airing ${airInfo.formattedDateTime}`,
    variant: 'scheduled' as const
  };
}