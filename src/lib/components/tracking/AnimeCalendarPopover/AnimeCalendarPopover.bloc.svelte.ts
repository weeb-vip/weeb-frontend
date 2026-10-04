import { format } from 'date-fns';
import { fromStore, type Readable } from 'svelte/store';
import { getAnimeTitle, preferencesStore, type TitleLanguage } from '$lib/stores/preferences';
import { animeHref } from '$lib/services/utils';
import { isPhone } from '$lib/stores/viewport';

export interface PreferencesPort extends Readable<{ titleLanguage: TitleLanguage }> {}

/*
 * Below the phone breakpoint the popover centres on its cell instead of
 * hanging off its left edge. The answer comes from the shared `isPhone`
 * store: a month of entries used to each own a `matchMedia` listener, which
 * was a few hundred listeners registered in one hydration task.
 */

/** The props the view feeds in. A getter, so the bloc reads it live. */
export interface AnimeCalendarPopoverInputs {
  readonly anime: any;
}

export interface AnimeCalendarPopoverDeps {
  preferences?: PreferencesPort;
  /** Phone-width or not; one shared store rather than a listener per entry. */
  viewport?: Readable<boolean>;
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
  readonly #viewport: { readonly current: boolean };
  readonly #prefs: { current: { titleLanguage: TitleLanguage } };

  #isOpen = $state(false);

  constructor(inputs: AnimeCalendarPopoverInputs, deps: AnimeCalendarPopoverDeps = {}) {
    this.#inputs = inputs;
    this.#viewport = fromStore(deps.viewport ?? isPhone);
    this.#prefs = fromStore(deps.preferences ?? preferencesStore);
  }

  get anime(): any {
    return this.#inputs.anime;
  }

  /** Where the row's poster and title point. */
  get href(): string {
    return animeHref({ id: this.anime.id, slug: this.anime.slug });
  }

  /**
   * Three is what fits on one line beside the poster at this width; the row
   * used to marquee the whole list on hover, which a touch device cannot reach
   * -- and this popover opens from a tap.
   */
  get tags(): string[] {
    return (this.anime.tags ?? []).slice(0, 3);
  }

  get isOpen(): boolean {
    return this.#isOpen;
  }

  /** Phone-width: the card centres on its cell rather than hanging off its left edge. */
  get isCompact(): boolean {
    return this.#viewport.current;
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
