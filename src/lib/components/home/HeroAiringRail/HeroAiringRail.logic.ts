/**
 * The rail's row summary: how many rows it draws, and the three short strings
 * each row prints.
 *
 * Every field comes off the one EpisodeTiming resolved in
 * HomepageSSR.processCurrentlyAiring. The rail no longer formats a time or
 * reads a variant of its own: when it did, it printed the exact airTime while
 * the hero printed the reconstructed broadcast slot, and the two disagreed.
 */

/** How many rows fit beside the banner. */
export const RAIL_LIMIT = 8;

export interface RailRowMeta {
  episode: string;
  localTime: string;
  countdown: string;
  isLive: boolean;
}

/**
 * "When", in the rail's own short form rather than `timing.label`.
 *
 * `label` is written for surfaces that show nothing else -- so past a day out
 * it reads "Airing Tue 7:30 AM". Here that is the same string the row already
 * prints on the line below the title, so every row beyond tomorrow said the
 * time twice.
 *
 * It also cost the titles. That column is content-sized and the title column
 * absorbs whatever is left, so a row reading "Airing Tue 10:00 AM" truncated
 * its title far earlier than one reading "Airing in 15h" -- the same show
 * ellipsised at a different place depending on how far away it airs.
 *
 * These forms are short and near enough to one width that the titles line up.
 */
export function whenLabel(timing: any, now: number = Date.now()): string {
  if (!timing) return '';
  if (timing.isLive) return timing.countdown === 'AIRING NOW' ? 'Now' : timing.countdown;
  if (timing.hasAired) return 'Aired';
  // Inside a day the shared countdown is already the right shape: 45m, 15h.
  if (timing.countdown) return `in ${timing.countdown}`;
  // Beyond that, days -- the exact time is on the line below.
  const start = timing.airDateTime ? new Date(timing.airDateTime).getTime() : NaN;
  if (Number.isNaN(start)) return '';
  const days = Math.max(1, Math.ceil((start - now) / 86400000));

  return `in ${days}d`;
}

export function rowMeta(entry: any): RailRowMeta {
  const timing = entry.airingInfo?.timing;
  const current = entry.airingInfo?.nextEpisode?.episodeNumber ?? 0;
  return {
    episode: current ? `EP ${current}` : '',
    localTime: timing?.localTime ?? '',
    countdown: whenLabel(timing),
    isLive: timing?.isLive ?? false
  };
}

export function railRows(entries: any[]): any[] {
  return entries.slice(0, RAIL_LIMIT);
}
