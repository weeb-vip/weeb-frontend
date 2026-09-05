/**
 * The airing page's pure rules: how a page of `currentlyAiring` becomes a flat
 * list of episode entries, how those entries bucket into days, and how a month
 * grid is laid out over them.
 *
 * This is a plain module rather than part of the bloc on purpose. All of it is
 * a function of (data, now, timezone) with no state, and it is the part that
 * was wrong for months while it lived inside a 1444-line component where
 * nothing could reach it: the merge dropped episodes, the day bucketing and the
 * calendar counts spelled "which local day is this" three different ways, and
 * none of it had a test. Runes modules cannot be loaded by ts-jest; a `.ts`
 * module can, which is the whole reason for the split.
 */

import { formatInTimeZone } from 'date-fns-tz';
import { resolveEpisodeTiming, parseDurationToMinutes } from '../../services/airTimeUtils';
import { isOnList as statusIsOnList } from '../utils/status';

// ── Timezone ────────────────────────────────────────────────────

/**
 * The offsets the picker names are the offsets it means. `Etc/GMT+5` is UTC-5
 * (the sign is inverted in that database, not a typo) and, unlike
 * `America/New_York`, it does not become UTC-4 for half the year -- so a label
 * reading "EST (UTC-5)" stays true in July. Tokyo has no DST at all, so the
 * real zone is exact there.
 */
export const TIMEZONE_ZONES: Record<string, string> = {
  JST: 'Asia/Tokyo',
  EST: 'Etc/GMT+5',
  GMT: 'Etc/UTC',
  PST: 'Etc/GMT+8',
  CET: 'Etc/GMT-1',
};

export interface TimezoneOption {
  value: string;
  label: string;
}

/** The picker's contents. `local` is first and is whatever the browser resolves. */
export function timezoneOptions(localZone: string): TimezoneOption[] {
  return [
    { value: 'local', label: localZone },
    { value: 'JST', label: 'JST (UTC+9)' },
    { value: 'EST', label: 'EST (UTC-5)' },
    { value: 'GMT', label: 'GMT (UTC+0)' },
    { value: 'PST', label: 'PST (UTC-8)' },
    { value: 'CET', label: 'CET (UTC+1)' },
  ];
}

/** A picker value becomes the IANA zone every format call goes through. */
export function resolveTimeZone(value: string, localZone: string): string {
  return TIMEZONE_ZONES[value] ?? localZone;
}

/**
 * The clock face on a card. The picker used to be bound to a variable nothing
 * read, so choosing JST changed nothing on screen; every time on the page was
 * the viewer's own regardless.
 */
export function formatTimeInZone(at: Date, zone: string): string {
  try {
    return formatInTimeZone(at, zone, 'HH:mm');
  } catch {
    return '';
  }
}

/**
 * The calendar day an instant falls on, in the chosen zone. Every day key on
 * this page -- schedule groups, calendar cells, per-day counts -- comes from
 * here, so they cannot disagree about where midnight is.
 */
export function isoDayInZone(at: Date, zone: string): string {
  try {
    return formatInTimeZone(at, zone, 'yyyy-MM-dd');
  } catch {
    return isoDay(at);
  }
}

/** The local calendar day, zero-padded. */
export function isoDay(at: Date): string {
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(
    at.getDate(),
  ).padStart(2, '0')}`;
}

// ── Shapes ──────────────────────────────────────────────────────

export interface AiringShow {
  id?: string | null;
  slug?: string | null;
  titleEn?: string | null;
  titleJp?: string | null;
  description?: string | null;
  tags?: string[] | null;
  duration?: string | null;
  broadcast?: string | null;
  startDate?: string | null;
  imageUrl?: string | null;
  userAnime?: unknown;
  episodes?: AiringEpisode[] | null;
  nextEpisode?: AiringEpisode | null;
  [key: string]: unknown;
}

export interface AiringEpisode {
  id?: string | null;
  episodeNumber?: number | null;
  /**
   * A string off the wire. Entries carry the resolved instant here instead, so
   * anything reading an entry's episode gets the same Date the rest of the page
   * sorted and bucketed by rather than re-parsing the raw field.
   */
  airDate?: string | Date | null;
  airTime?: string | null;
  [key: string]: unknown;
}

/** One episode of one show, which is the unit every view on this page renders. */
export interface AiringEntry {
  id: string;
  anime: Record<string, unknown> & { id?: string | null; slug?: string | null };
  airingInfo: Record<string, unknown> & {
    id?: string | null;
    nextEpisodeDate: Date;
    nextEpisode: AiringEpisode;
    userAnime: unknown;
  };
}

export interface DayGroup {
  id: string;
  dayName: string;
  date: string;
  isToday: boolean;
  entries: AiringEntry[];
}

export interface CalendarDay {
  num: number;
  iso: string;
  otherMonth: boolean;
  isToday: boolean;
  showCount: number;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// ── Merging pages ───────────────────────────────────────────────

/**
 * Union several `currentlyAiring` pages into one list of shows.
 *
 * Paging the calendar past the initial two-month window refetches a wider
 * range, and the same show comes back in both responses with a different slice
 * of its episodes. Keeping the first copy and skipping the id -- what this used
 * to do -- discarded every episode outside the first window for any show also
 * airing inside it, which is nearly all of them: the calendar went blank one
 * click away from today. Later fields win; episode lists are merged by number.
 */
export function mergeAiringPages(...pages: (AiringShow[] | null | undefined)[]): AiringShow[] {
  const byId = new Map<string, AiringShow>();

  for (const page of pages) {
    for (const show of page ?? []) {
      if (!show?.id) continue;

      const existing = byId.get(show.id);
      if (!existing) {
        byId.set(show.id, show);
        continue;
      }

      const episodes = [...(existing.episodes ?? [])];
      const seen = new Set(episodes.map((episode) => episode?.episodeNumber));
      for (const episode of show.episodes ?? []) {
        if (!episode || seen.has(episode.episodeNumber)) continue;
        seen.add(episode.episodeNumber);
        episodes.push(episode);
      }

      byId.set(show.id, { ...existing, ...show, episodes });
    }
  }

  return [...byId.values()];
}

// ── Expanding episodes ──────────────────────────────────────────

/**
 * Flatten shows into one entry per episode, in air order.
 *
 * Timing is resolved through `resolveEpisodeTiming`, the same helper the
 * homepage uses, so the two pages date an episode identically. The page used to
 * date it from `episode.airTime` while labelling it from (airDate, broadcast),
 * which are two different answers whenever the weekly slot and the real
 * broadcast fall on different days for the viewer.
 */
export function expandEpisodes(shows: AiringShow[], now: Date): AiringEntry[] {
  const entries: AiringEntry[] = [];
  const seenKeys = new Set<string>();

  for (const show of shows) {
    if (!show) continue;

    const episodes: AiringEpisode[] =
      show.episodes && show.episodes.length > 0
        ? show.episodes
        : show.nextEpisode
          ? [show.nextEpisode]
          : [];

    for (const episode of episodes) {
      if (!episode || (!episode.airDate && !episode.airTime)) continue;

      // Same show, same episode number, twice -- the merged pages overlap.
      const dedupeKey = `${show.id}-ep${episode.episodeNumber}`;
      if (seenKeys.has(dedupeKey)) continue;

      const timing = resolveEpisodeTiming(
        // Off the wire `airDate` is always a string; the Date arm of the type
        // only exists for the resolved copy this function hands back.
        { airDate: typeof episode.airDate === 'string' ? episode.airDate : null, airTime: episode.airTime },
        show.broadcast,
        parseDurationToMinutes(show.duration),
        now,
      );
      if (!timing) continue;

      seenKeys.add(dedupeKey);

      entries.push({
        id: `airing-${show.id}-ep${episode.episodeNumber}`,
        anime: {
          id: show.id,
          slug: show.slug,
          titleEn: show.titleEn,
          titleJp: show.titleJp,
          description: show.description,
          tags: show.tags ?? [],
          episodeCount: show.episodes?.length ?? null,
          duration: show.duration,
          startDate: show.startDate,
          imageUrl: show.imageUrl,
          userAnime: show.userAnime ?? null,
        },
        airingInfo: {
          ...show,
          timing,
          airTimeDisplay: { show: true, text: timing.label, variant: timing.variant },
          nextEpisodeDate: timing.airDateTime,
          nextEpisode: { ...episode, airDate: timing.airDateTime },
          userAnime: show.userAnime ?? null,
          isInWatchlist: false,
        },
      });
    }
  }

  return entries.sort(
    (a, b) => a.airingInfo.nextEpisodeDate.getTime() - b.airingInfo.nextEpisodeDate.getTime(),
  );
}

// ── Day bucketing ───────────────────────────────────────────────

/**
 * An entry belongs to the reader's list.
 *
 * Through `utils/status`, which is the app's one answer to "is this on a
 * list" -- it also recognises the legacy `PLAN_TO_WATCH` / `ON_HOLD` spellings
 * that a bare `userAnime != null` check silently lumped in with everything
 * else.
 */
export function isOnList(entry: AiringEntry): boolean {
  const userAnime = entry.airingInfo.userAnime as { status?: string | null } | null | undefined;
  return statusIsOnList(userAnime?.status);
}

function visible(entries: AiringEntry[], myListOnly: boolean): AiringEntry[] {
  return myListOnly ? entries.filter(isOnList) : entries;
}

/**
 * Group entries by the day they air on, oldest first.
 *
 * `zone` decides where a day starts, so switching the picker to JST re-buckets
 * a 01:00 JST episode onto the Japanese day it actually airs rather than the
 * viewer's previous evening.
 */
export function buildDayGroups(
  entries: AiringEntry[],
  now: Date,
  zone: string,
  myListOnly = false,
): DayGroup[] {
  const todayIso = isoDayInZone(now, zone);
  const byDay = new Map<string, AiringEntry[]>();

  for (const entry of visible(entries, myListOnly)) {
    const iso = isoDayInZone(entry.airingInfo.nextEpisodeDate, zone);
    const bucket = byDay.get(iso);
    if (bucket) bucket.push(entry);
    else byDay.set(iso, [entry]);
  }

  return [...byDay.keys()].sort().map((iso) => {
    // Noon, so a day label can never be dragged onto its neighbour by the
    // host's own UTC offset.
    const at = new Date(`${iso}T12:00:00`);
    return {
      id: iso,
      dayName: DAY_NAMES[at.getDay()],
      date: `${MONTH_NAMES[at.getMonth()]} ${at.getDate()}`,
      isToday: iso === todayIso,
      entries: byDay.get(iso)!,
    };
  });
}

/**
 * The schedule view starts at today. Yesterday's episodes still exist -- they
 * are what the calendar view is for -- but a forward-looking schedule that
 * opens on last week is answering a question nobody asked.
 */
export function upcomingDayGroups(groups: DayGroup[], now: Date, zone: string): DayGroup[] {
  const todayIso = isoDayInZone(now, zone);
  return groups.filter((group) => group.id >= todayIso);
}

/** Everything airing on one calendar day, in air order. */
export function entriesOnDay(
  entries: AiringEntry[],
  iso: string,
  zone: string,
  myListOnly = false,
): AiringEntry[] {
  return visible(entries, myListOnly).filter(
    (entry) => isoDayInZone(entry.airingInfo.nextEpisodeDate, zone) === iso,
  );
}

/**
 * The calendar page's own bucketing: one row per episode, keyed by day, with
 * the whole show carried along because the popover renders from it.
 *
 * Same day key as everything else on the airing pages. It used to be a local
 * `format(date, 'yyyy-MM-dd')`, which is a fourth spelling of "which day is
 * this" and answered differently from the other three for a late-night slot.
 */
export function groupShowsByDay(
  shows: AiringShow[],
  zone: string,
): Record<string, (AiringShow & { episodeAirTime: Date })[]> {
  const byDay: Record<string, (AiringShow & { episodeAirTime: Date })[]> = {};

  for (const show of shows) {
    if (!show) continue;

    const episodes =
      show.episodes && show.episodes.length > 0
        ? show.episodes
        : show.nextEpisode
          ? [show.nextEpisode]
          : [];

    for (const episode of episodes) {
      const at = episodeInstant(episode);
      if (!at) continue;

      const key = isoDayInZone(at, zone);
      // A single-episode array, because the popover renders "this episode on
      // this day" and a show airing twice in a month is two rows, not one.
      (byDay[key] ??= []).push({ ...show, episodes: [episode], episodeAirTime: at });
    }
  }

  for (const key of Object.keys(byDay)) {
    byDay[key].sort((a, b) => a.episodeAirTime.getTime() - b.episodeAirTime.getTime());
  }

  return byDay;
}

/** The exact timestamp when there is one, the bare date otherwise. */
function episodeInstant(episode: AiringEpisode | null | undefined): Date | null {
  if (!episode) return null;
  const raw = episode.airTime ?? episode.airDate;
  if (!raw) return null;
  const at = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(at.getTime()) ? null : at;
}

// ── Calendar grid ───────────────────────────────────────────────

/**
 * The month grid: a whole number of Monday-first weeks covering the month, with
 * the neighbouring months' days filling the ends.
 *
 * The count on a cell is the number of episodes airing that day under the
 * current filter, computed from the same `isoDayInZone` the schedule groups
 * use. It used to be a second, hand-spelled date comparison, which is how the
 * calendar and the list could show a different number of shows for one day.
 */
export function buildCalendarGrid(
  year: number,
  month: number,
  entries: AiringEntry[],
  options: { now: Date; zone: string; myListOnly?: boolean },
): CalendarDay[] {
  const { now, zone, myListOnly = false } = options;

  // getDay() is Sunday-first; the grid is Monday-first.
  const startDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7;
  const todayIso = isoDayInZone(now, zone);

  // One pass over the entries rather than one per cell: the old grid filtered
  // the whole list 35-42 times per render, once for every square.
  const counts = new Map<string, number>();
  for (const entry of visible(entries, myListOnly)) {
    const iso = isoDayInZone(entry.airingInfo.nextEpisodeDate, zone);
    counts.set(iso, (counts.get(iso) ?? 0) + 1);
  }

  const days: CalendarDay[] = [];
  for (let cell = 0; cell < totalCells; cell++) {
    let num: number;
    let iso: string;
    let otherMonth = false;

    if (cell < startDow) {
      num = daysInPrevMonth - startDow + 1 + cell;
      const m = month === 0 ? 11 : month - 1;
      const y = month === 0 ? year - 1 : year;
      iso = isoFor(y, m, num);
      otherMonth = true;
    } else if (cell >= startDow + daysInMonth) {
      num = cell - startDow - daysInMonth + 1;
      const m = month === 11 ? 0 : month + 1;
      const y = month === 11 ? year + 1 : year;
      iso = isoFor(y, m, num);
      otherMonth = true;
    } else {
      num = cell - startDow + 1;
      iso = isoFor(year, month, num);
    }

    days.push({
      num,
      iso,
      otherMonth,
      isToday: iso === todayIso,
      showCount: counts.get(iso) ?? 0,
    });
  }

  return days;
}

function isoFor(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** The month heading, e.g. "March 2026". */
export function monthLabel(year: number, month: number): string {
  return new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/** The side panel's heading for a selected day. */
export function dayLabel(iso: string | null): string {
  if (!iso) return '--';
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ── Countdown ───────────────────────────────────────────────────

export type CountdownStatus = 'aired' | 'airing-now' | 'upcoming';

export interface Countdown {
  text: string;
  status: CountdownStatus;
}

/**
 * The badge on a schedule card.
 *
 * Deliberately not `EpisodeTiming.countdown`: that one goes blank past 24
 * hours, which is most of what a two-month schedule contains. This is the
 * long-horizon spelling ("In 3d 5h") and it needs to stay a separate,
 * exercised rule rather than a second opinion buried in a template.
 */
export function countdownFor(airTime: Date, now: Date): Countdown {
  const diffMs = airTime.getTime() - now.getTime();

  // A show stays "LIVE" for half an hour after its slot opens, which is about
  // as long as an episode runs.
  if (diffMs <= 0 && Math.abs(diffMs) <= 30 * 60 * 1000) {
    return { text: 'LIVE', status: 'airing-now' };
  }
  if (diffMs <= 0) return { text: 'Aired', status: 'aired' };

  const totalMinutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  if (hours < 24) {
    return {
      text: `In ${hours}h ${String(totalMinutes % 60).padStart(2, '0')}m`,
      status: 'upcoming',
    };
  }

  return { text: `In ${Math.floor(hours / 24)}d ${hours % 24}h`, status: 'upcoming' };
}
