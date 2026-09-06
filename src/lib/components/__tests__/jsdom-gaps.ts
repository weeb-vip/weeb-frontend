/**
 * Test support: the two browser APIs the show-page components need that jsdom
 * does not implement.
 *
 * Neither is a mock of app code -- both stand in for something the *platform*
 * is missing, so a component that is correct in a browser can still be mounted
 * here. Anything they make un-assertable (a measured height, a decoded image)
 * is said so at the call site and left to the Playwright layer.
 *
 * Lives in `__tests__/` rather than beside a component because several
 * component suites need them; the coverage config already excludes the folder.
 */

/**
 * `bind:clientHeight` compiles to a ResizeObserver, which jsdom has no
 * implementation of at all -- mounting `ShowSectionNav` or `ShowStickyHeader`
 * without this throws `ResizeObserver is not defined` before any markup exists.
 *
 * It never fires: jsdom performs no layout, so there is no resize to report and
 * every measured height stays 0. That is the honest answer here -- "the bar is
 * 48px tall" is a browser fact, not a jsdom one.
 */
export function stubResizeObserver(): () => void {
  const original = (globalThis as { ResizeObserver?: unknown }).ResizeObserver;

  class NoLayoutResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }

  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = NoLayoutResizeObserver;

  return () => {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = original;
  };
}

/**
 * `SafeImage` probes each candidate with `new Image()` and waits for `onload`
 * or `onerror`. jsdom loads nothing, so neither ever fires and the probe hangs
 * until the per-try timeout -- which would make every test that renders artwork
 * wait three seconds and then assert against a half-settled component.
 *
 * Failing the probe immediately puts SafeImage in its settled "no artwork"
 * state, which is a real state of the app (a show with no images) and leaves
 * the rest of the component assertable. Whether the *real* artwork paints is a
 * network fact and belongs to the e2e layer.
 */
export function stubNeverLoadingImages(): () => void {
  const original = globalThis.Image;

  class NeverLoadsImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    decoding = 'auto';
    naturalWidth = 0;
    naturalHeight = 0;
    #src = '';
    get src(): string {
      return this.#src;
    }
    set src(value: string) {
      this.#src = value;
      queueMicrotask(() => this.onerror?.());
    }
  }

  globalThis.Image = NeverLoadsImage as unknown as typeof Image;

  return () => {
    globalThis.Image = original;
  };
}
