import { format } from 'date-fns';
import { fromStore, type Readable } from 'svelte/store';
import { getAnimeTitle, preferencesStore, type TitleLanguage } from '../stores/preferences';

export interface PreferencesPort extends Readable<{ titleLanguage: TitleLanguage }> {}

/**
 * `window.matchMedia`, as the two calls this needs. A port because a story has
 * no viewport to speak of and a unit test has no `window` at all.
 */
export interface MediaQueryPort {
  matches: (query: string) => boolean;
  onChange: (query: string, listener: (matches: boolean) => void) => () => void;
}

export const browserMediaQuery: MediaQueryPort = {
  matches: (query) => (typeof window === 'undefined' ? false : window.matchMedia(query).matches),
  onChange: (query, listener) => {
    if (typeof window === 'undefined') return () => {};
    const list = window.matchMedia(query);
    const handler = (event: MediaQueryListEvent) => listener(event.matches);
    list.addEventListener('change', handler);
    return () => list.removeEventListener('change', handler);
  }
};

/** Below this the popover centres on its cell instead of hanging off its left edge. */
const COMPACT_QUERY = '(max-width: 767px)';

/** The props the view feeds in. A getter, so the bloc reads it live. */
export interface AnimeCalendarPopoverInputs {
  readonly anime: any;
}

export interface AnimeCalendarPopoverDeps {
  preferences?: PreferencesPort;
  mediaQuery?: MediaQueryPort;
}

/**
 * One cell of the airing calendar: a button that opens a card for the episode.
 *
 * The popover's placement used to live here as hand-rolled maths -- including
 * a `window.scrollY` term added to what is a `position: fixed` element, so the
 * card drifted down the page by exactly the scroll offset. `anchoredPosition`
 * works in viewport coordinates, where that term does not exist, so the bug is
 * gone with the code that held it.
 */
export class AnimeCalendarPopoverBloc {
  readonly #inputs: AnimeCalendarPopoverInputs;
  readonly #mediaQuery: MediaQueryPort;
  readonly #prefs: { current: { titleLanguage: TitleLanguage } };

  #isOpen = $state(false);
  #isCompact = $state(false);

  constructor(inputs: AnimeCalendarPopoverInputs, deps: AnimeCalendarPopoverDeps = {}) {
    this.#inputs = inputs;
    this.#mediaQuery = deps.mediaQuery ?? browserMediaQuery;
    this.#isCompact = this.#mediaQuery.matches(COMPACT_QUERY);
    this.#prefs = fromStore(deps.preferences ?? preferencesStore);
  }

  get anime(): any {
    return this.#inputs.anime;
  }

  get isOpen(): boolean {
    return this.#isOpen;
  }

  /** Phone-width: the card centres on its cell rather than hanging off its left edge. */
  get isCompact(): boolean {
    return this.#isCompact;
  }

  /** Keeps {@link isCompact} true. Call from an effect and return the teardown. */
  watchViewport(): () => void {
    this.#isCompact = this.#mediaQuery.matches(COMPACT_QUERY);
    return this.#mediaQuery.onChange(COMPACT_QUERY, (matches) => (this.#isCompact = matches));
  }

  get title(): string {
    return getAnimeTitle(this.#inputs.anime, this.#prefs.current.titleLanguage);
  }

  /** The next episode this cell is about; the calendar packs one per entry. */
  get episode(): any {
    return this.#inputs.anime?.episodes?.[0];
  }

  get episodeNumber(): string {
    return this.episode?.episodeNumber?.toString() ?? '?';
  }

  /** The air time, when there is one -- otherwise the button shows the title alone. */
  get airTimeText(): string | null {
    return this.#inputs.anime?.episodeAirTime
      ? format(this.#inputs.anime.episodeAirTime, 'h:mm a')
      : null;
  }

  get buttonTitle(): string {
    const time = this.airTimeText ? ` at ${this.airTimeText}` : '';
    return `${this.title} (Ep ${this.episodeNumber})${time}`;
  }

  /** The card's date line: the resolved air time, else the raw episode date. */
  get airDateLabel(): string {
    const anime = this.#inputs.anime;
    if (anime?.episodeAirTime) {
      return format(anime.episodeAirTime, "EEE MMM do 'at' h:mm a");
    }
    if (this.episode?.airDate) {
      return format(new Date(this.episode.airDate), 'EEE MMM do');
    }
    return 'Unknown';
  }

  get episodeTitle(): string {
    return this.episode?.titleEn || this.episode?.titleJp || 'Unknown';
  }

  /** MAL reports duration as "24 min per ep"; the card wants the number alone. */
  get episodeLength(): string {
    const duration = this.#inputs.anime?.duration;
    return duration ? duration.replace(/per.+?$/, '') : '?';
  }

  togglePopover(): void {
    this.#isOpen = !this.#isOpen;
  }

  closePopover(): void {
    this.#isOpen = false;
  }
}
