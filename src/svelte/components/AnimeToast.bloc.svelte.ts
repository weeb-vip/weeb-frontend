import { goto } from '$app/navigation';
import { fromStore, type Readable } from 'svelte/store';
import { animeHref } from '../../services/utils';
import { getAnimeTitle, preferencesStore, type TitleLanguage } from '../stores/preferences';

export type AnimeToastStatus = 'airing-soon' | 'airing' | 'finished' | 'warning';

export interface ToastAnime {
  id?: string | number;
  slug?: string | null;
  titleEn?: string;
  titleJp?: string;
  imageUrl?: string;
}

export interface ToastEpisode {
  episodeNumber?: number;
  titleEn?: string;
  titleJp?: string;
}

export interface PreferencesPort extends Readable<{ titleLanguage: TitleLanguage }> {}

/** Navigation, narrowed to the one call this makes. */
export type NavigatePort = (href: string) => void;

/**
 * Whether this is a touch/small device. A port because the answer is drawn
 * from `window`, `navigator` and a resize listener -- none of which a story or
 * a test should have to fake wholesale to see the mobile layout.
 */
export interface DevicePort {
  isCompact: () => boolean;
  /** Notifies on resize; returns its own teardown. */
  onChange: (listener: (isCompact: boolean) => void) => () => void;
}

/**
 * The original check, kept whole: a narrow viewport, an iPad (which reports a
 * desktop user agent), or a touch-capable phone user agent.
 */
function detectCompact(): boolean {
  if (typeof window === 'undefined') return false;
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isNarrowScreen = window.innerWidth < 1024;
  const isIPad = /iPad|Macintosh/.test(navigator.userAgent) && hasTouch;
  const isMobileUserAgent =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  return isNarrowScreen || isIPad || (hasTouch && isMobileUserAgent);
}

export const browserDevice: DevicePort = {
  isCompact: detectCompact,
  onChange: (listener) => {
    if (typeof window === 'undefined') return () => {};
    const handler = () => listener(detectCompact());
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }
};

/** The props the view feeds in. Getters, so the bloc reads them live. */
export interface AnimeToastInputs {
  readonly anime: ToastAnime;
  readonly episode: ToastEpisode;
  readonly status: AnimeToastStatus;
}

export interface AnimeToastDeps {
  preferences?: PreferencesPort;
  navigate?: NavigatePort;
  device?: DevicePort;
}

/**
 * The body of an episode toast.
 *
 * It reads the title-language preference, decides whether the whole card or
 * only an explicit arrow button navigates (a touch device must not navigate on
 * what was really a scroll), and performs the navigation. All three are the
 * reasons it has a bloc.
 */
export class AnimeToastBloc {
  readonly #inputs: AnimeToastInputs;
  readonly #navigate: NavigatePort;
  readonly #device: DevicePort;
  readonly #prefs: { current: { titleLanguage: TitleLanguage } };

  #isCompact = $state(false);

  constructor(inputs: AnimeToastInputs, deps: AnimeToastDeps = {}) {
    this.#inputs = inputs;
    this.#navigate = deps.navigate ?? goto;
    this.#device = deps.device ?? browserDevice;
    this.#prefs = fromStore(deps.preferences ?? preferencesStore);
    this.#isCompact = this.#device.isCompact();
  }

  /** Keeps {@link isCompact} true. Call from an effect and return the teardown. */
  watchViewport(): () => void {
    this.#isCompact = this.#device.isCompact();
    return this.#device.onChange((isCompact) => (this.#isCompact = isCompact));
  }

  /** On a touch device the card is not clickable; an explicit button navigates. */
  get isCompact(): boolean {
    return this.#isCompact;
  }

  get title(): string {
    return getAnimeTitle(this.#inputs.anime, this.#prefs.current.titleLanguage);
  }

  get imageUrl(): string | undefined {
    return this.#inputs.anime?.imageUrl;
  }

  get status(): AnimeToastStatus {
    return this.#inputs.status;
  }

  get episodeTitle(): string {
    return this.#inputs.episode?.titleEn || this.#inputs.episode?.titleJp || '';
  }

  get episodeNumber(): string | number {
    return this.#inputs.episode?.episodeNumber || '?';
  }

  get goToShowLabel(): string {
    return `Go to ${this.title} page`;
  }

  /** The whole card navigates on a pointer device, and only there. */
  activateCard(): void {
    if (this.#isCompact) return;
    this.#open();
  }

  /** The arrow button, which navigates on every device. */
  activateButton(event?: Event): void {
    event?.stopPropagation();
    this.#open();
  }

  #open(): void {
    const anime = this.#inputs.anime;
    if (!anime?.id) return;
    this.#navigate(animeHref({ id: String(anime.id), slug: anime.slug }));
  }
}
