import { format, isDate } from 'date-fns';
import { tick } from 'svelte';

/** One row of the list. The API shape is loose, so this is what is actually read. */
export interface EpisodeLike {
  id?: string;
  episodeNumber: number;
  titleEn?: string | null;
  titleJp?: string | null;
  airDate?: string | null;
  [key: string]: unknown;
}

/** What the view knows about the show and the viewer, read live. */
export type EpisodesAccessor = () => {
  episodes: EpisodeLike[];
  /**
   * How many episodes the viewer has watched, as the aggregate on their list
   * entry. Only a fallback: it can express "up to N" and nothing else, so
   * `watchedNumbers` wins wherever it is available.
   */
  watchedCount: number;
  /**
   * Episode numbers the viewer has actually finished, or null when the caller
   * has no per-episode data -- signed out, or still loading.
   */
  watchedNumbers: Set<number> | null;
  canTrack: boolean;
  pending: boolean;
};

export interface WatchIntent {
  episodeNumber: number;
  watched: boolean;
}

export interface EpisodesDeps {
  source?: EpisodesAccessor;
  /** Where a watch toggle goes. The view forwards it to its `onWatch` prop. */
  watch?: (intent: WatchIntent) => void;
  /**
   * Returns the reader to the top of the list after a collapse. The view owns
   * the element; the bloc owns when it matters.
   */
  scrollToTop?: () => void;
  /**
   * "Now", for deciding what has aired. Injected so a story can pin a date and
   * keep its unaired rows unaired forever.
   */
  now?: () => Date;
  /**
   * Rendered before the reader asks for more. A 500-episode show shipped every
   * row into the SSR payload -- 796KB for Naruto, 960KB for Bleach -- on a
   * product whose third principle is that fast beats rich.
   */
  initialRows?: number;
}

/**
 * The episode list's reading order, its cut-off, and what counts as watched.
 *
 * A list this long is mostly decisions: newest-first or oldest-first, the first
 * N rows or all of them, which episode is the next one to air, and whether a
 * given row is ticked. None of that is markup, and all of it is worth being
 * able to test without rendering 500 rows.
 */
export class EpisodesBloc {
  readonly #source: EpisodesAccessor;
  readonly #watch: (intent: WatchIntent) => void;
  readonly #scrollToTop: () => void;
  readonly #now: () => Date;
  readonly #initialRows: number;

  /**
   * Newest first by default: the recurring question is "did the latest one
   * drop", not "what was episode 1". Ascending is one click away for anyone
   * starting a show, which is the other real reading order.
   */
  #newestFirst = $state(true);
  #expanded = $state(false);

  constructor({
    source = () => ({
      episodes: [],
      watchedCount: 0,
      watchedNumbers: null,
      canTrack: false,
      pending: false,
    }),
    watch = () => {},
    scrollToTop = () => {},
    now = () => new Date(),
    initialRows = 24,
  }: EpisodesDeps = {}) {
    this.#source = source;
    this.#watch = watch;
    this.#scrollToTop = scrollToTop;
    this.#now = now;
    this.#initialRows = initialRows;
  }

  get canTrack(): boolean {
    return this.#source().canTrack;
  }

  get pending(): boolean {
    return this.#source().pending;
  }

  get watchedCount(): number {
    return this.#source().watchedCount;
  }

  get newestFirst(): boolean {
    return this.#newestFirst;
  }

  get expanded(): boolean {
    return this.#expanded;
  }

  get sortLabel(): string {
    return this.#newestFirst ? 'Newest first' : 'Oldest first';
  }

  get ordered(): EpisodeLike[] {
    const episodes = this.#source().episodes ?? [];
    return [...episodes].sort((a, b) =>
      this.#newestFirst ? b.episodeNumber - a.episodeNumber : a.episodeNumber - b.episodeNumber,
    );
  }

  /** The rows on screen: the first page of them, or all of them once expanded. */
  get visible(): EpisodeLike[] {
    const ordered = this.ordered;
    return this.#expanded ? ordered : ordered.slice(0, this.#initialRows);
  }

  get total(): number {
    return this.ordered.length;
  }

  get hiddenCount(): number {
    return this.total - this.visible.length;
  }

  /** "12 episodes", "1 episode" -- the count line's noun has to agree. */
  get countLabel(): string {
    const total = this.total;
    return `${total} ${total === 1 ? 'episode' : 'episodes'}`;
  }

  /**
   * The first episode that has not aired. It is the one the whole page is
   * about, and it used to be distinguishable only by 0.5 opacity on a 13px
   * numeral.
   */
  get nextUp(): EpisodeLike | undefined {
    return [...(this.#source().episodes ?? [])]
      .filter((episode) => !this.isAired(episode))
      .sort((a, b) => a.episodeNumber - b.episodeNumber)[0];
  }

  airDateOf(episode: EpisodeLike): Date | null {
    if (!episode?.airDate) return null;
    const date = new Date(episode.airDate);
    return isDate(date) && !Number.isNaN(date.getTime()) ? date : null;
  }

  isAired(episode: EpisodeLike): boolean {
    const date = this.airDateOf(episode);
    return date ? date < this.#now() : false;
  }

  isNextUp(episode: EpisodeLike): boolean {
    const next = this.nextUp;
    return Boolean(next && episode.id === next.id);
  }

  /**
   * The next episode carries a local time; the rest only need a date. Times are
   * rendered in the viewer's zone, which is the whole point of storing them.
   */
  dateLabel(episode: EpisodeLike): string {
    const date = this.airDateOf(episode);
    if (!date) return 'TBA';
    return this.isNextUp(episode) ? format(date, 'd MMM, h:mm a') : format(date, 'd MMM yyyy');
  }

  /**
   * Per-episode when we have it. The count is a fallback for the moment before
   * that query resolves, and it can only express "up to N" -- which is exactly
   * the limitation it replaced.
   */
  isWatched(episode: EpisodeLike): boolean {
    const { watchedNumbers, watchedCount } = this.#source();
    if (watchedNumbers) return watchedNumbers.has(episode.episodeNumber);
    return watchedCount >= episode.episodeNumber;
  }

  watchLabel(episode: EpisodeLike): string {
    return this.isWatched(episode)
      ? `Mark episode ${episode.episodeNumber} unwatched`
      : `Mark episode ${episode.episodeNumber} watched`;
  }

  toggleSort(): void {
    this.#newestFirst = !this.#newestFirst;
  }

  expand(): void {
    this.#expanded = true;
  }

  async collapse(): Promise<void> {
    this.#expanded = false;
    // After the rows are gone, not before: scrolling into the old layout lands
    // the reader at an offset the shrinking document immediately clamps away,
    // which measured as the list toolbar sitting under the sticky tab bar.
    await tick();
    this.#scrollToTop();
  }

  /**
   * The episode itself, not a new high-water mark. Watching 1, 2 and 5 is a
   * thing people do, and the old model could only say "up to 5" -- which
   * silently claimed 3 and 4 as well.
   */
  toggleWatched(episode: EpisodeLike): void {
    const { canTrack, pending } = this.#source();
    if (!canTrack || pending) return;
    this.#watch({
      episodeNumber: episode.episodeNumber,
      watched: !this.isWatched(episode),
    });
  }
}
