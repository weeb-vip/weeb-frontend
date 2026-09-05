import { page } from '$app/stores';
import { derived, fromStore, type Readable } from 'svelte/store';

/** The current path, which is all the nav needs `page` for. */
export type RoutePort = Readable<string>;

/**
 * requestAnimationFrame, injected so a story or a test can drive the easing
 * by hand instead of waiting on a real frame.
 */
export interface FramePort {
  request(callback: () => void): number;
  cancel(handle: number): void;
}

export const realFrames: FramePort = {
  request: (callback) =>
    typeof requestAnimationFrame === 'function' ? requestAnimationFrame(callback) : 0,
  cancel: (handle) => {
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(handle);
  }
};

/** Whether the visitor has asked for less movement. */
export type ReducedMotionPort = () => boolean;

export const realReducedMotion: ReducedMotionPort = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Distance over which the bar earns its glass back. */
const SOLID_OVER = 220;
/** Per-frame approach; settles in ~250ms at 60fps. */
const EASE = 0.14;

export function seasonSlug(now: Date = new Date()): string {
  const month = now.getMonth();
  const year = now.getFullYear();
  if (month >= 0 && month <= 2) return `WINTER_${year}`;
  if (month >= 3 && month <= 5) return `SPRING_${year}`;
  if (month >= 6 && month <= 8) return `SUMMER_${year}`;
  return `FALL_${year}`;
}

export interface HeaderDeps {
  /** Overlay pages start transparent over artwork; everything else starts solid. */
  overlay?: boolean;
  route?: RoutePort;
  frames?: FramePort;
  prefersReducedMotion?: ReducedMotionPort;
}

/**
 * How solid the nav bar is, and which nav item is current.
 *
 * The easing is the reason this is a bloc rather than three lines in the view:
 * scroll events do not arrive one per frame -- a single wheel tick can move
 * scrollY by 200px in ONE event, which drove the value straight from 0 to 1 in
 * a single frame and read as the background popping in. Mapping it more
 * gradually does not help, because the input itself is a jump. So a scroll
 * only sets a TARGET and a frame loop eases the rendered value toward it: the
 * fade becomes a property of the animation rather than of how the input is
 * delivered.
 */
export class HeaderBloc {
  readonly #route: { current: string };
  readonly #frames: FramePort;
  readonly #reducedMotion: ReducedMotionPort;

  // Reactive, not fixed at construction: the layout decides `overlay` from the
  // current route, so navigating from the artwork-backed home page to a plain
  // one has to hand the bar its glass back.
  #overlay = $state(false);
  #solid = $state(1);
  #target = 1;
  #frame = 0;

  constructor({
    overlay = false,
    route = derived(page, ($page) => $page.url.pathname),
    frames = realFrames,
    prefersReducedMotion = realReducedMotion
  }: HeaderDeps = {}) {
    this.#route = fromStore(route);
    this.#frames = frames;
    this.#reducedMotion = prefersReducedMotion;
    this.#applyOverlay(overlay);
  }

  get overlay(): boolean {
    return this.#overlay;
  }

  /** Called by the view whenever the route changes what kind of page this is. */
  setOverlay(next: boolean): void {
    if (next === this.#overlay) return;
    this.#applyOverlay(next);
  }

  #applyOverlay(next: boolean): void {
    this.#overlay = next;
    // A page with artwork behind the bar starts dissolved; one without starts
    // -- and stays -- solid.
    this.#solid = next ? 0 : 1;
    this.#target = this.#solid;
  }

  /** 0 = fully transparent over artwork, 1 = the resting glass bar. */
  get solid(): number {
    return this.#solid;
  }

  /** Below this the bar has no glass to blur, and the filter stays off entirely. */
  get hasGlass(): boolean {
    return !this.#overlay || this.#solid > 0.02;
  }

  get pathname(): string {
    return this.#route.current ?? '/';
  }

  /** Home matches exactly; sections match by prefix so a detail page stays lit. */
  isCurrent(href: string): boolean {
    if (href === '/') return this.pathname === '/';

    return this.pathname.startsWith(href);
  }

  get seasonHref(): string {
    return `/season/${seasonSlug()}`;
  }

  /** A scroll only moves the target; the frame loop does the travelling. */
  scrolled(scrollY: number): void {
    this.#target = Math.min(1, Math.max(0, scrollY / SOLID_OVER));
    if (this.#reducedMotion()) {
      this.#solid = this.#target;
      return;
    }
    if (!this.#frame) this.#frame = this.#frames.request(() => this.#step());
  }

  #step(): void {
    this.#frame = 0;
    const delta = this.#target - this.#solid;
    if (Math.abs(delta) < 0.002) {
      this.#solid = this.#target;
      return;
    }
    this.#solid += delta * EASE;
    this.#frame = this.#frames.request(() => this.#step());
  }

  destroy(): void {
    if (this.#frame) this.#frames.cancel(this.#frame);
    this.#frame = 0;
  }
}
