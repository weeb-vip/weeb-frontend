import type { ToasterProps } from 'svelte-sonner';

export type ToastPosition = NonNullable<ToasterProps['position']>;

/** Below this the toast stack spans the width instead of hugging the corner. */
export const MOBILE_QUERY = '(max-width: 768px)';

/**
 * "Are we on a narrow viewport, and tell me when that changes."
 *
 * A port because the real one is `matchMedia`: it does not exist during SSR,
 * and a story must be able to pin the answer rather than have the toaster
 * follow the size of the Storybook canvas.
 */
export interface ViewportPort {
  /** Reports the current match immediately, then on change. Returns teardown. */
  watch(onChange: (matches: boolean) => void): () => void;
}

/**
 * The real viewport. `matchMedia` rather than the resize listener this used to
 * use: the browser evaluates the query itself, so it fires only when the answer
 * actually flips instead of on every resize frame.
 */
export function mediaQueryViewport(query: string = MOBILE_QUERY): ViewportPort {
  return {
    watch(onChange) {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};

      const mql = window.matchMedia(query);
      const handle = (event: MediaQueryList | MediaQueryListEvent) => onChange(event.matches);

      handle(mql);
      mql.addEventListener('change', handle);

      return () => mql.removeEventListener('change', handle);
    },
  };
}

/** A viewport that never changes. Stories and SSR use this. */
export function fixedViewport(matches: boolean): ViewportPort {
  return {
    watch(onChange) {
      onChange(matches);
      return () => {};
    },
  };
}

export interface GlobalToasterDeps {
  viewport?: ViewportPort;
}

/**
 * Where the toast stack lives. The corner is wrong on a phone -- a 22rem card
 * pinned right either overflows or crowds the edge -- so narrow viewports get
 * the top-centre stack that the stylesheet stretches edge to edge.
 */
export class GlobalToasterBloc {
  readonly #viewport: ViewportPort;

  #isMobile = $state(false);

  constructor({ viewport = mediaQueryViewport() }: GlobalToasterDeps = {}) {
    this.#viewport = viewport;
  }

  get isMobile(): boolean {
    return this.#isMobile;
  }

  /**
   * Defaults to the desktop corner, which is what SSR and the first client
   * render agree on before the media query has been asked.
   */
  get position(): ToastPosition {
    return this.#isMobile ? 'top-center' : 'top-right';
  }

  /** Track the viewport; returns the teardown for the view's `$effect`. */
  watchViewport(): () => void {
    return this.#viewport.watch((matches) => {
      this.#isMobile = matches;
    });
  }
}
