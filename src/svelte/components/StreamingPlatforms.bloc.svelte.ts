import { isFeatureEnabled } from '../../utils/analytics';

/** The one thing this component asks of analytics: is the flag on yet. */
export interface FeatureFlagPort {
  isEnabled(flag: string): boolean;
}

export interface StreamingPlatformsDeps {
  flags?: FeatureFlagPort;
  /** How often to re-ask while the flag is still unresolved. */
  pollMs?: number;
  /** How many times to re-ask before giving up (25 x 250ms ~= 6s). */
  maxTries?: number;
}

export const STREAMING_FLAG = 'animeschedule-integration';

/**
 * Locally-bundled brand logos (static/assets/streams). AnimeSchedule's own logo
 * CDN 403s on hotlinking, so we self-host. Platforms without a bundled logo fall
 * back to a generic mark rather than to a broken image.
 */
const PLATFORM_ICONS: Record<string, string> = {
  crunchyroll: '/assets/streams/crunchyroll.svg',
  netflix: '/assets/streams/netflix.svg',
  amazon: '/assets/streams/amazon.svg',
  'prime video': '/assets/streams/amazon.svg',
  primevideo: '/assets/streams/amazon.svg',
  hulu: '/assets/streams/hulu.svg',
  apple: '/assets/streams/apple.svg',
  'apple tv': '/assets/streams/apple.svg',
  appletv: '/assets/streams/apple.svg',
  youtube: '/assets/streams/youtube.svg',
  bilibili: '/assets/streams/bilibili.svg',
};

const GENERIC_ICON = '/assets/streams/generic.svg';

/**
 * The "watch on" row's gate and its lookups.
 *
 * The gate is the reason this has a bloc at all: the flag is client-only, so it
 * is empty during SSR, and on a hard load PostHog has not loaded flags by the
 * time the component mounts. Its `onFeatureFlags` event can fire once while the
 * flag still reads false and then never fire again -- so the answer has to be
 * re-asked on a short interval until it resolves. That is a timer, which is not
 * something a view should own, and it is exactly what a story wants to skip.
 */
export class StreamingPlatformsBloc {
  readonly #flags: FeatureFlagPort;
  readonly #pollMs: number;
  readonly #maxTries: number;

  #enabled = $state(false);

  constructor({
    flags = { isEnabled: isFeatureEnabled },
    pollMs = 250,
    maxTries = 25,
  }: StreamingPlatformsDeps = {}) {
    this.#flags = flags;
    this.#pollMs = pollMs;
    this.#maxTries = maxTries;
    // Asked once up front, so a stub that already knows the answer -- or a
    // second mount after the flags have landed -- needs no interval at all.
    this.#enabled = flags.isEnabled(STREAMING_FLAG);
  }

  get enabled(): boolean {
    return this.#enabled;
  }

  /**
   * Keep asking until the flag resolves. Returns the teardown, so the view can
   * hand it straight back from an `$effect`.
   */
  watchFlag(): () => void {
    if (this.#enabled) return () => {};

    let tries = 0;
    const timer = setInterval(() => {
      this.#enabled = this.#flags.isEnabled(STREAMING_FLAG);
      if (this.#enabled || ++tries >= this.#maxTries) clearInterval(timer);
    }, this.#pollMs);

    return () => clearInterval(timer);
  }

  /** The bundled logo for a platform, or the generic mark. */
  iconFor(platform: string): string {
    return PLATFORM_ICONS[platform.toLowerCase()] ?? GENERIC_ICON;
  }

  /** Some rows arrive without a scheme; a bare host would resolve as a relative path. */
  hrefFor(url: string): string {
    return url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
  }
}
