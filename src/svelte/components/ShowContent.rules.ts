/**
 * The show page's decisions, as plain functions.
 *
 * Everything here used to live as a reactive statement inside
 * `ShowContent.svelte` — which meant none of it could be exercised without
 * mounting 1,778 lines of component. It is deliberately a plain `.ts` module
 * rather than a `.svelte.ts` one so the test suite can import it directly:
 * ts-jest cannot load a runes module, and a rule that has to be re-typed into
 * its own test is a rule that drifts.
 *
 * The bloc (`ShowContent.bloc.svelte.ts`) owns the state and the ports; this
 * owns the arithmetic.
 */

export type ShowStatus = 'loading' | 'error' | 'ready';

/** What the page loader handed the component. */
export interface ShowSsrPayload {
  animeData: { anime?: any } | null;
  error: unknown;
}

/** The three fields the details query is read for. */
export interface ShowQuerySnapshot {
  data?: { anime?: any } | null;
  isLoading: boolean;
  isError: boolean;
}

export interface ResolvedShow {
  status: ShowStatus;
  anime: any | null;
}

/**
 * A client refetch that came back without the viewer's row must not blank a row
 * the server render already had: the field is authenticated, and a cold client
 * fetch loses it for a beat. Returns the query's own object untouched when
 * there is nothing to carry over, so the identity stays stable across reads.
 */
export function mergeUserAnime(queryAnime: any, ssrAnime: any): any {
  if (!queryAnime) return queryAnime;
  if (queryAnime.userAnime || !ssrAnime?.userAnime) return queryAnime;
  return { ...queryAnime, userAnime: ssrAnime.userAnime };
}

/**
 * Which of the three states the page is in, and which record it renders.
 *
 * The precedence is the whole point of SSR here: the loader's payload renders
 * on the first frame, the query supersedes it once it answers, and a loader
 * error is recoverable — the client fetch still runs and a successful one
 * clears the error rather than leaving a dead page behind.
 */
export function resolveShow(ssr: ShowSsrPayload, query: ShowQuerySnapshot): ResolvedShow {
  const ssrAnime = ssr.animeData?.anime ?? null;
  const queryAnime = query.data?.anime ?? null;

  if (queryAnime) {
    return { status: 'ready', anime: mergeUserAnime(queryAnime, ssrAnime) };
  }
  if (ssrAnime) {
    return { status: 'ready', anime: ssrAnime };
  }
  if (ssr.error) {
    return { status: 'error', anime: null };
  }
  if (query.isError) {
    return { status: 'error', anime: null };
  }
  // Not started or in flight. A query that has settled with neither an anime
  // nor an error is a 200 with nothing in it, which is a failure to the reader.
  return query.isLoading ? { status: 'loading', anime: null } : { status: 'error', anime: null };
}

// ── Sections ────────────────────────────────────────────────

export const SYNOPSIS = 'synopsis';
export const NEWS = 'news';
export const EPISODES = 'episodes';
export const CHARACTERS = 'characters';

/** One entry of the section nav. Shaped for `Tabs`' `TabItem`. */
export interface SectionTab {
  value: string;
  label: string;
  count?: number | null;
}

export interface SectionInputs {
  newsEnabled: boolean;
  newsCount: number;
  episodeCount: number;
}

/**
 * Which sections exist for this show, in page order.
 *
 * Synopsis and Characters are unconditional — both render something for every
 * anime, an empty state included. News and Episodes are guarded on having rows,
 * because a tab that scrolls to an empty heading is a promise the page cannot
 * keep. The order here IS the page order; the scroll spy depends on it.
 */
export function sectionTabs({ newsEnabled, newsCount, episodeCount }: SectionInputs): SectionTab[] {
  const tabs: SectionTab[] = [{ value: SYNOPSIS, label: 'Synopsis' }];
  if (newsEnabled && newsCount > 0) tabs.push({ value: NEWS, label: 'News', count: newsCount });
  if (episodeCount > 0) tabs.push({ value: EPISODES, label: 'Episodes', count: episodeCount });
  tabs.push({ value: CHARACTERS, label: 'Characters' });
  return tabs;
}

/** The DOM id a section renders under, so the bloc can find it without a `bind:this`. */
export function sectionElementId(section: string): string {
  return `show-section-${section}`;
}

/**
 * The section the reader is looking at.
 *
 * Checked bottom-up so the lowest section that has crossed the line wins: on
 * the way down, several sections are above the threshold at once and only the
 * last of them is the one filling the viewport. Sections with no element (not
 * rendered for this show) are skipped rather than treated as at the top.
 */
export function activeSection(
  sections: string[],
  topOf: (section: string) => number | null,
  threshold: number,
): string {
  for (let i = sections.length - 1; i >= 0; i--) {
    const top = topOf(sections[i]);
    if (top !== null && top < threshold) return sections[i];
  }
  return sections[0] ?? SYNOPSIS;
}

/**
 * Where the page must scroll so a section clears the nav and the sticky stack.
 * Never negative: the first section sits under a hero that starts above the
 * document origin, and a negative target scrolls nowhere in some browsers and
 * to the top in others.
 */
export function sectionScrollTop(
  sectionTop: number,
  scrollY: number,
  navHeight: number,
  stackHeight: number,
): number {
  return Math.max(0, sectionTop + scrollY - navHeight - stackHeight - 8);
}

/**
 * The measured height of everything pinned under the nav, published as
 * `--weeb-sticky-offset` for `scroll-padding-top` in base.scss.
 *
 * Three places used to carry their own idea of this number — CSS said 0,
 * the scroll helper said 72 + 48, and only the scroll handler measured it —
 * which is why a focused element or an anchor landed underneath the bars.
 */
export function stickyStackHeight(
  stickyVisible: boolean,
  stickyHeight: number,
  tabBarHeight: number,
): number {
  return (stickyVisible ? stickyHeight : 0) + tabBarHeight;
}

/**
 * The tab bar's own offset. One pixel back so its top border lands on the
 * sticky header's bottom border instead of doubling it.
 */
export function tabBarTop(stickyVisible: boolean, stickyHeight: number): string {
  const above = stickyVisible ? Math.max(stickyHeight - 1, 0) : 0;
  return `calc(var(--weeb-nav-height, 60px) + ${above}px)`;
}

// ── Tracking ────────────────────────────────────────────────

/**
 * Where a ± step lands. Clamped at both ends, because the stepper is held down
 * and because a show whose episode count is unknown must still not go negative.
 */
export function clampEpisodeCount(current: number, delta: number, max: number | null): number {
  const next = Math.max(0, current + delta);
  return max === null ? next : Math.min(next, max);
}

/** The show's length, or null when neither the count nor a list gives one. */
export function episodeTotal(anime: any): number | null {
  return anime?.episodeCount || anime?.episodes?.length || null;
}

/**
 * A tracking write carries the whole row. A score-only or episodes-only write
 * would blank the status the viewer already set, because the mutation replaces.
 */
export function trackingInput(anime: any, overrides: { score?: number; episodes?: number }) {
  return {
    animeID: anime?.id,
    status: anime?.userAnime?.status ?? undefined,
    score: anime?.userAnime?.score ?? undefined,
    episodes: anime?.userAnime?.episodes ?? 0,
    ...overrides,
  };
}

/**
 * Which episodes are actually ticked.
 *
 * Null until the query has answered, so the list falls back to the aggregate
 * count rather than drawing every episode unwatched for a moment — which would
 * invite a click that un-marks something.
 */
export function watchedNumbersFrom(rows: { episodeNumber: number }[] | null | undefined): Set<number> | null {
  return rows ? new Set(rows.map((row) => row.episodeNumber)) : null;
}

// ── Quick info ──────────────────────────────────────────────

export interface NextChipInputs {
  hasSchedule: boolean;
  live: boolean;
  aired: boolean;
  countdown: string;
  episodeNumber: string;
}

/**
 * The one amber chip in the stats row. Null when there is nothing to say —
 * a finished show gets no chip rather than an empty one.
 */
export function nextEpisodeChip({
  hasSchedule,
  live,
  aired,
  countdown,
  episodeNumber,
}: NextChipInputs): string | null {
  if (!hasSchedule) return null;
  if (live) return 'NOW';
  if (aired) return countdown === 'JUST AIRED' ? 'Just aired' : episodeNumber ? `Ep ${episodeNumber} aired` : null;
  if (countdown && countdown !== 'AIRING NOW' && !countdown.includes('JUST AIRED')) {
    return `Next in ${countdown}`;
  }
  if (episodeNumber) return `Next: Ep ${episodeNumber}`;
  return 'Next soon';
}

/** "Airing now" / "Recently aired" / "Next episode" for the schedule panel. */
export function scheduleLabel(live: boolean, aired: boolean): string {
  return live ? 'Airing now' : aired ? 'Recently aired' : 'Next episode';
}

/** The airing/finished chip. `endDate` is the only signal the record carries. */
export function airingChip(anime: any): { label: string; airing: boolean } {
  const airing = !anime?.endDate;
  return { label: airing ? 'Airing' : 'Finished', airing };
}

/** Studios arrive as an array from some sources and a bare string from others. */
export function firstStudio(studios: unknown): string | null {
  if (Array.isArray(studios)) return studios.length ? String(studios[0]) : null;
  return studios ? String(studios) : null;
}

/** Same shape, joined, for the information grid. */
export function allStudios(studios: unknown): string | null {
  if (Array.isArray(studios)) return studios.length ? studios.join(', ') : null;
  return studios ? String(studios) : null;
}

/**
 * Ordered artwork candidates for the hero and the sticky header.
 *
 * Both are keyed by anime id: `banners/<id>` for the TheTVDB artwork synced by
 * thetvdb-enrichment, `<id>` at the root for the poster. Built through the
 * image-url port so they follow `config.cdn_url` — hardcoding the host meant
 * local and staging read production artwork, which hid the fact that staging
 * had no banners of its own.
 */
export function heroImageSources(animeId: string | null | undefined, imageUrl: (id: string, path?: string) => string): string[] {
  if (!animeId) return [];
  return [imageUrl(animeId, 'banners'), imageUrl(animeId)];
}
