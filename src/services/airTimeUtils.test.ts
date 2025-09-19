import {describe, expect, test, beforeEach} from '@jest/globals';
import {
  getCurrentTime,
  parseDurationToMinutes,
  parseAirTime,
  getAirDateTime,
  isAiringToday,
  isCurrentlyAiring,
  hasAlreadyAired,
  calculateCountdown,
  getAirTimeInfo,
  findNextEpisode,
  getAirTimeDisplay,
  Episode
} from "./airTimeUtils";
import currentlyAiring from '../../currentlyaired.json';

// Mock window object for testing
const mockWindow = {
  __DEV_TIME_OFFSET__: 0
};
(global as any).window = mockWindow;

describe('getCurrentTime', () => {
  beforeEach(() => {
    mockWindow.__DEV_TIME_OFFSET__ = 0;
  });

  test('returns current time when no offset', () => {
    const before = Date.now();
    const result = getCurrentTime();
    const after = Date.now();

    expect(result.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.getTime()).toBeLessThanOrEqual(after);
  });

});

describe('parseDurationToMinutes', () => {
  test('parses standard format correctly', () => {
    expect(parseDurationToMinutes("24 min per episode")).toBe(24);
    expect(parseDurationToMinutes("23 min per ep")).toBe(23);
    expect(parseDurationToMinutes("24 min")).toBe(24);
    expect(parseDurationToMinutes("12 minutes")).toBe(12);
  });

  test('handles edge cases', () => {
    expect(parseDurationToMinutes(null)).toBe(null);
    expect(parseDurationToMinutes(undefined)).toBe(null);
    expect(parseDurationToMinutes("")).toBe(null);
    expect(parseDurationToMinutes("no numbers")).toBe(null);
  });

  test('extracts first number from string', () => {
    expect(parseDurationToMinutes("Episode duration: 24 min, 30 sec")).toBe(24);
  });
});

describe('parseAirTime', () => {
  test('correctly converts JST to UTC', () => {
    const airDate = "2025-07-05T00:00:00Z";
    const broadcast = "Saturdays at 00:00 (JST)";
    const expectedLocalDate = new Date("2025-07-04T11:00:00-04:00"); // 10am EDT on July 4, 2025

    const parsedDate = parseAirTime(airDate, broadcast);
    expect(parsedDate).toEqual(expectedLocalDate);
  });

  test('handles Sunday JST broadcast correctly', () => {
    const airDate = "2025-08-31T00:00:00Z";
    const broadcast = "Sundays at 01:30 (JST)";
    const expectedLocalDate = new Date("2025-08-30T12:30:00-04:00"); // 11:30am EDT on Aug 30, 2025

    const parsedDate = parseAirTime(airDate, broadcast);
    expect(parsedDate).toEqual(expectedLocalDate);
  });

  test('handles midnight JST correctly', () => {
    const airDate = "2025-08-31T00:00:00Z";
    const broadcast = "Sundays at 00:00 (JST)";
    const expectedLocalDate = new Date("2025-08-30T11:00:00-04:00"); // 10am EDT on Aug 30, 2025

    const parsedDate = parseAirTime(airDate, broadcast);
    expect(parsedDate).toEqual(expectedLocalDate);
  });

  test('returns null for invalid inputs', () => {
    expect(parseAirTime(null, "Sundays at 01:30 (JST)")).toBe(null);
    expect(parseAirTime("2025-08-31T00:00:00Z", null)).toBe(null);
    expect(parseAirTime(undefined, undefined)).toBe(null);
  });

  test('handles broadcasts without time zone', () => {
    const airDate = "2025-08-31T00:00:00Z";
    const broadcast = "Sundays at 01:30";

    const parsedDate = parseAirTime(airDate, broadcast);
    expect(parsedDate).not.toBe(null);
  });

  test('handles non-JST timezone', () => {
    const airDate = "2025-08-31T00:00:00Z";
    const broadcast = "Sundays at 01:30 (UTC)";

    const parsedDate = parseAirTime(airDate, broadcast);
    expect(parsedDate).toEqual(new Date("2025-08-31T01:30:00Z"));
  });
});


describe('getAirDateTime', () => {
  const TZ = 'America/New_York';

  test('formats air date and time correctly', () => {
    const airDate = '2025-08-31T00:00:00Z';
    const broadcast = 'Sundays at 01:30 (JST)';

    const result = getAirDateTime(airDate, broadcast, { timeZone: TZ });
    // 01:30 JST Sun = 16:30 UTC Sat = 11:30 AM Sat in New York (EDT) (DST)
    expect(result).toBe('Sat Aug 30th at 12:30 PM');
  });

  test('returns fallback format for missing broadcast', () => {
    const airDate = '2025-08-31T00:00:00Z';

    const result = getAirDateTime(airDate, null, { timeZone: TZ });
    // 00:00 UTC Sun is Sat local in New York (EDT)
    expect(result).toBe('Sat Aug 30th');
  });

  test('returns "Unknown" for missing air date', () => {
    expect(getAirDateTime(null, 'Sundays at 01:30 (JST)', { timeZone: TZ }))
      .toBe('Unknown');
  });
});

describe('isAiringToday (static time)', () => {
  beforeAll(() => {
    // Freeze "now" to Sat Aug 30, 2025 12:00:00 UTC
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-08-30T16:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test('returns true for episodes airing within 24 hours', () => {
    // 2025-08-31 (Sun) @ 01:30 JST → 2025-08-30 16:30 UTC
    // From frozen now (12:00 UTC) that’s +4h30m → within 24h
    const airDate = '2025-08-31'; // JP broadcast day (YYYY-MM-DD)
    const broadcast = 'Sundays at 01:30 (JST)';

    expect(isAiringToday(airDate, broadcast)).toBe(true);
  });

  test('returns false for episodes airing more than 24 hours away', () => {
    // 2025-09-01 (Mon) @ 23:30 JST → 2025-09-01 14:30 UTC
    // From frozen now (2025-08-30 12:00 UTC) that’s ~50h30m → >24h
    const airDate = '2025-09-01';
    const broadcast = 'Mondays at 23:30 (JST)';

    expect(isAiringToday(airDate, broadcast)).toBe(false);
  });

  test('returns false for invalid inputs', () => {
    expect(isAiringToday(null, 'Sundays at 01:30 (JST)')).toBe(false);
    expect(isAiringToday('2025-08-31', null)).toBe(false);
  });
});

describe('isCurrentlyAiring (static time)', () => {
  beforeAll(() => {
    // Freeze "now" to Sat Aug 30, 2025 12:00:00 UTC
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-08-30T12:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test('returns true for episode currently airing', () => {
    // Started 10 minutes ago: 11:50 UTC = 20:50 JST (same day)
    const airDate = '2025-08-30';
    const broadcast = 'Saturdays at 20:50 (JST)';
    expect(isCurrentlyAiring(airDate, broadcast, 24)).toBe(true);
  });

  test("returns false for episode that hasn't started", () => {
    // Starts in 10 minutes: 12:10 UTC = 21:10 JST
    const airDate = '2025-08-30';
    const broadcast = 'Saturdays at 21:10 (JST)';
    expect(isCurrentlyAiring(airDate, broadcast, 24)).toBe(false);
  });

  test('returns false for episode that has finished', () => {
    // Started 30 minutes ago: 11:30 UTC = 20:30 JST
    // With 24m duration, it ended at 11:54 UTC (< now), so not currently airing
    const airDate = '2025-08-30';
    const broadcast = 'Saturdays at 20:30 (JST)';
    expect(isCurrentlyAiring(airDate, broadcast, 24)).toBe(false);
  });

  test('uses default duration when not provided', () => {
    // Same as first case; omit duration -> default 24m
    const airDate = '2025-08-30';
    const broadcast = 'Saturdays at 20:50 (JST)';
    expect(isCurrentlyAiring(airDate, broadcast)).toBe(true);
  });
});

describe('hasAlreadyAired (static time)', () => {
  beforeAll(() => {
    // Freeze "now" to Sat Aug 30, 2025 12:00:00 UTC
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-08-30T12:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test('returns true for episode that finished recently', () => {
    // 20:00 JST on 2025-08-30 -> 11:00 UTC (started 1h ago)
    // With 24m duration, it ended at 11:24 UTC (< now), so recently aired.
    const airDate = '2025-08-30';
    const broadcast = 'Saturdays at 20:00 (JST)';
    expect(hasAlreadyAired(airDate, broadcast, 24)).toBe(true);
  });

  test('returns false for episode that aired too long ago', () => {
    // 20:00 JST on 2025-08-22 -> 11:00 UTC on Aug 22 (8 days before frozen now)
    // Assume your function treats >7 days as "too long ago".
    const airDate = '2025-08-22';
    const broadcast = 'Fridays at 20:00 (JST)';
    expect(hasAlreadyAired(airDate, broadcast, 24)).toBe(false);
  });

  test('returns false for future episode', () => {
    // 22:00 JST on 2025-08-30 -> 13:00 UTC (1h in the future from frozen now)
    const airDate = '2025-08-30';
    const broadcast = 'Saturdays at 22:00 (JST)';
    expect(hasAlreadyAired(airDate, broadcast, 24)).toBe(false);
  });
});

describe('calculateCountdown (static time)', () => {
  beforeAll(() => {
    // Freeze "now" to Sat Aug 30, 2025 12:00:00 UTC
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-08-30T12:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test('returns countdown for future episode airing today', () => {
    // 23:00 JST on 2025-08-30 -> 14:00 UTC (2h from now)
    const airDate = '2025-08-30';
    const broadcast = 'Saturdays at 23:00 (JST)';
    expect(calculateCountdown(airDate, broadcast, 24)).toBe('2h');
  });

  test('returns "AIRING NOW" for currently airing episode (long duration)', () => {
    // 20:50 JST -> 11:50 UTC (started 10m ago). With 120m duration, remaining >= 60 -> "AIRING NOW"
    const airDate = '2025-08-30';
    const broadcast = 'Saturdays at 20:50 (JST)';
    expect(calculateCountdown(airDate, broadcast, 120)).toBe('AIRING NOW');
  });

  test('returns empty string for episodes not airing today (>24h)', () => {
    // 23:00 JST on 2025-09-01 -> 14:00 UTC (≈50h from now)
    const airDate = '2025-09-01';
    const broadcast = 'Mondays at 23:00 (JST)';
    expect(calculateCountdown(airDate, broadcast, 24)).toBe('');
  });

  test('returns "JUST AIRED" for recently finished episode', () => {
    // 20:30 JST -> 11:30 UTC. With 24m duration, ended at 11:54 UTC (6m ago)
    const airDate = '2025-08-30';
    const broadcast = 'Saturdays at 20:30 (JST)';
    expect(calculateCountdown(airDate, broadcast, 24)).toBe('JUST AIRED');
  });
});

describe('getAirTimeInfo (static time)', () => {
  beforeAll(() => {
    // Freeze "now" to Sat Aug 30, 2025 12:00:00 UTC
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-08-30T16:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test('returns comprehensive air time info', () => {
    // 23:00 JST on 2025-08-30 -> 14:00 UTC (which is 2h from frozen now)
    const airDate = '2025-08-31';
    const broadcast = 'Sundays at 01:30 (JST)';

    const result = getAirTimeInfo(airDate, broadcast, 24);

    const airingToda= isAiringToday(airDate, broadcast)
    expect(airingToda).toBe(true);

    expect(result).not.toBe(null);
    expect(result).toHaveProperty('airDate');
    expect(result).toHaveProperty('isAiringToday', true);
    expect(result).toHaveProperty('hasAlreadyAired', false);
    expect(result).toHaveProperty('countdown', '30m');
    expect(result).toHaveProperty('formattedDateTime');
  });

  test('returns comprehensive air time info', () => {
    // 23:00 JST on 2025-08-30 -> 14:00 UTC (which is 2h from frozen now)
    const airDate = '2025-08-30';
    const broadcast = 'Saturdays at 23:00 (JST)';

    const result = getAirTimeInfo(airDate, broadcast, 24);


    expect(result).not.toBe(null);
    expect(result).toHaveProperty('airDate');
    expect(result).toHaveProperty('isAiringToday', false);
    expect(result).toHaveProperty('hasAlreadyAired', true);
    expect(result).toHaveProperty('countdown', 'JUST AIRED');
    expect(result).toHaveProperty('formattedDateTime');
  });

  test('returns null for invalid air date', () => {
    const result = getAirTimeInfo(null, 'Sundays at 01:30 (JST)', 24);
    expect(result).toBe(null);
  });
});

describe('findNextEpisode', () => {
  test('returns proper next episode from real data', () => {
    // find by animeid 83076d4f-300f-45b1-b082-83d8e838a527
    const anime = currentlyAiring.data.currentlyAiring.find((anime: { id: string }) => anime.id === '83076d4f-300f-45b1-b082-83d8e838a527');
    const now = new Date("2025-08-29T08:30:00-04:00"); // Aug 29, 2025 8:30am EDT

    // @ts-ignore
    const result = findNextEpisode(anime.episodes, anime.broadcast, now);
    const nextEpisode = result?.episode;

    expect(nextEpisode).not.toBeNull();
    expect(nextEpisode).toHaveProperty('episodeNumber', 9);
    expect(nextEpisode).toHaveProperty('airDate', "2025-08-31T00:00:00Z");
  });

  test('returns null for empty episodes array', () => {
    const result = findNextEpisode([], "Sundays at 01:30 (JST)");
    expect(result).toBe(null);
  });

  test('returns null for null episodes', () => {
    const result = findNextEpisode(null, "Sundays at 01:30 (JST)");
    expect(result).toBe(null);
  });

  test('finds next episode within 24 hour window', () => {
    const now = new Date("2025-08-30T08:00:00-04:00");
    const episodes: Episode[] = [
      {
        id: "1",
        episodeNumber: 1,
        titleEn: "Episode 1",
        titleJp: null,
        airDate: "2025-08-30T00:00:00Z" // This should convert to Aug 29 in EDT, so within 24h window
      },
      {
        id: "2",
        episodeNumber: 2,
        titleEn: "Episode 2",
        titleJp: null,
        airDate: "2025-09-01T00:00:00Z" // Future episode
      }
    ];

    const result = findNextEpisode(episodes, "Saturdays at 11:30 (JST)", now);
    expect(result).not.toBe(null);
    expect(result?.episode.episodeNumber).toBe(1);
  });
});

describe('getAirTimeDisplay (static time)', () => {
  const FROZEN_NOW = new Date('2025-08-30T12:00:00Z'); // Sat 12:00 UTC

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FROZEN_NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test('returns correct display for currently airing episode', () => {
    // 20:50 JST on 2025-08-30 -> 11:50 UTC (started 10m ago; 24m duration => airing)
    const airDate = '2025-08-30';
    const broadcast = 'Saturdays at 20:50 (JST)';

    const result = getAirTimeDisplay(airDate, broadcast, 24);

    expect(result).not.toBe(null);
    expect(result?.variant).toBe('airing');
    expect(result?.text).toContain('Currently airing');
  });

  test('returns correct display for future episode', () => {
    // 23:00 JST -> 14:00 UTC (2h from frozen now)
    const airDate = '2025-08-30';
    const broadcast = 'Saturdays at 23:00 (JST)';

    const result = getAirTimeDisplay(airDate, broadcast, 24);

    expect(result).not.toBe(null);
    expect(result?.variant).toBe('countdown');
    expect(result?.text).toContain('Airing in 2h');
  });

  test('returns correct display for recently aired episode', () => {
    // 20:30 JST -> 11:30 UTC; ended at 11:54 UTC (6m ago) -> recently aired
    const airDate = '2025-08-30';
    const broadcast = 'Saturdays at 20:30 (JST)';

    const result = getAirTimeDisplay(airDate, broadcast, 24);

    expect(result).not.toBe(null);
    expect(result?.variant).toBe('aired');
    expect(result?.text).toBe('Recently aired');
  });

  test('returns scheduled display for episodes not airing today', () => {
    // 23:00 JST on 2025-09-02 -> 14:00 UTC (≈> 72h away)
    const airDate = '2025-09-02';
    const broadcast = 'Tuesdays at 23:00 (JST)';

    const result = getAirTimeDisplay(airDate, broadcast, 24);

    expect(result).not.toBe(null);
    expect(result?.variant).toBe('scheduled');
    expect(result?.text).toMatch(/^\w+ at \d+:\d+ [AP]M$/);
  });

  test('returns null for invalid input', () => {
    const result = getAirTimeDisplay(null, null, 24);
    expect(result).toBe(null);
  });
});
