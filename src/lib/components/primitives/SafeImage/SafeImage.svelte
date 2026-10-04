<script lang="ts">
  import debug from '$lib/utils/debug';
  import { PHONE_QUERY } from '$lib/stores/viewport';
  import { imagePolicyFromContext } from '$lib/stores/image-policy';
  import {
    DEFAULT_REJECT_PATTERNS,
    candidateSrcset,
    defaultAccept,
    loadReason,
    orderedSources,
    rawFor,
    rawSources,
    type ChosenDetail
  } from './SafeImage.logic';

  /**
   * An <img> with a fallback chain, rendered on the server.
   *
   * The first candidate goes straight into the HTML, so the browser starts the
   * request from the preload scanner, honours `loading="lazy"` and
   * `fetchpriority`, and paints without JavaScript. Only the fallback walk needs
   * a script: the element's own `error` event (or an `accept` rejection on
   * `load`) swaps in the next candidate, and once every candidate is spent the
   * fallback image or the titled panel takes over.
   *
   * This replaces a probe that created `new Image()` per candidate after
   * hydration and only then rendered the element. That meant no artwork at all
   * before the JS ran, every image on the page downloading at once regardless of
   * `loading`, and a hero that reached the screen seconds after the HTML did.
   */
  let {
    src = '',
    alt = '',
    fallbackSrc = '/assets/not found.jpg',
    /**
     * When set, a total load failure renders a titled panel instead of loading
     * fallbackSrc. `/assets/not found.jpg` is a bright white illustration: on this
     * near-black ground it became the highest-contrast object in the viewport, so
     * on a page whose thesis is "cover art carries the product" the missing art
     * out-shouted the real art. It is also indistinguishable from a poster, so a
     * reader cannot tell "no artwork" from "the artwork looks like that".
     */
    placeholderTitle = null,
    path = '',
    priority = false,
    className = '',
    style = '',
    width = undefined,
    height = undefined,
    loading = undefined,
    /** Intended device-pixel width. When set, CDN sources are routed through
     * Cloudflare Image Resizing (production only). Undefined = full-res (unchanged). */
    cdnWidth = undefined,
    /** Ordered list of candidate URLs (first has highest priority) */
    sources = [],
    /**
     * A second ordering for phone-width viewports, offered through a <picture>
     * source so the browser picks it before any script runs. The server has no
     * viewport: with one list, every phone first received the desktop art in
     * its HTML and swapped after hydration, paying for both. Walked in step with
     * `sources`: the i-th phone candidate falls with the i-th desktop one.
     */
    phoneSources = [],
    /** `cdnWidth` for the phone ordering. Defaults to `cdnWidth`. */
    phoneCdnWidth = undefined,
    /**
     * Widths to offer in a `srcset`, with `sizes` saying how wide the element
     * is laid out. The browser then picks the variant for its own pixel
     * density instead of everyone taking `cdnWidth`; `cdnWidth` stays the
     * plain `src` for anything that ignores srcset. Only CDN sources get one.
     */
    widths = [],
    sizes = undefined,
    /** `widths` for the phone ordering. Defaults to `widths`. */
    phoneWidths = undefined,
    /** Optional: reject by URL pattern (e.g., 404 placeholders) */
    rejectPatterns = DEFAULT_REJECT_PATTERNS,
    /** Custom acceptance check (URL + decoded dimensions) */
    accept = (img: HTMLImageElement, url: string) => defaultAccept(img, url, rejectPatterns),
    /**
     * Give up on a candidate that has neither loaded nor errored after this
     * many ms. Off by default: a real <img> reports a failure itself, and a
     * timer that fires mid-download on a slow link would abandon a good image
     * for the larger untransformed one behind it.
     */
    perTryTimeoutMs = 0,
    /** Called once a candidate has been settled on -- including the failure
     * cases, where `src` is the fallback or null. */
    onChosen,
  }: {
    src?: string;
    alt?: string;
    fallbackSrc?: string;
    placeholderTitle?: string | null;
    path?: string;
    priority?: boolean;
    className?: string;
    style?: string;
    width?: string | number;
    height?: string | number;
    loading?: 'lazy' | 'eager';
    cdnWidth?: number;
    sources?: string[];
    phoneSources?: string[];
    phoneCdnWidth?: number;
    widths?: number[];
    sizes?: string;
    phoneWidths?: number[];
    rejectPatterns?: (string | RegExp)[];
    accept?: (img: HTMLImageElement, url: string) => boolean;
    perTryTimeoutMs?: number;
    onChosen?: (detail: ChosenDetail) => void;
  } = $props();

  // The request's policy: the default, or the data-saver one. Read once; a
  // policy is per visitor, not per render.
  const policy = imagePolicyFromContext();

  const candidates = $derived(orderedSources(sources, src, path, cdnWidth, policy));
  const raw = $derived(rawSources(sources, src, path));
  const phoneCandidates = $derived(
    phoneSources.length > 0 ? orderedSources(phoneSources, '', path, phoneCdnWidth ?? cdnWidth, policy) : []
  );
  const phoneRaw = $derived(phoneSources.length > 0 ? rawSources(phoneSources, '', path) : []);
  const candidatesKey = $derived([...candidates, '|', ...phoneCandidates].join('\n'));
  const actualLoading = $derived(loading || (priority ? 'eager' : 'lazy'));

  /** Which candidate the element currently points at. */
  let index = $state(0);
  /** Every candidate failed; the fallback or the panel is showing. */
  let failed = $state(false);
  /** The element has decoded something real (or the fallback). */
  let painted = $state(false);
  /** Bumped to recreate the element, which is the only way to make the browser
   * re-request a URL it already gave up on. */
  let generation = $state(0);
  let imgEl = $state<HTMLImageElement | null>(null);

  const exhausted = $derived(failed || candidates.length === 0);
  const showPlaceholder = $derived(exhausted && !!placeholderTitle);
  const onFallback = $derived(exhausted && !placeholderTitle);
  const current = $derived.by<string | null>(() => {
    if (!exhausted) return candidates[index] ?? null;
    return placeholderTitle ? null : fallbackSrc || null;
  });
  /** The phone candidate shown beside `current`; none once the walk is over. */
  const phoneCurrent = $derived.by<string | null>(() => {
    if (exhausted || phoneCandidates.length === 0) return null;
    return phoneCandidates[Math.min(index, phoneCandidates.length - 1)] ?? null;
  });

  /** The srcset for the candidate on screen, where it can have one. */
  const currentSrcset = $derived.by<string | null>(() => {
    if (exhausted || widths.length === 0) return null;
    const source = rawFor(candidates, raw, index);
    return source ? candidateSrcset(source, widths, policy) : null;
  });
  const phoneSrcset = $derived.by<string | null>(() => {
    const list = phoneWidths ?? widths;
    if (exhausted || list.length === 0 || phoneCandidates.length === 0) return null;
    const source = rawFor(phoneCandidates, phoneRaw, Math.min(index, phoneCandidates.length - 1));
    return source ? candidateSrcset(source, list, policy) : null;
  });

  // Plain bookkeeping the template never reads.
  let settledFor = '';
  let reportedEmpty = false;

  function report(detail: ChosenDetail) {
    onChosen?.(detail);
  }

  /** Called for a decoded element: on `load`, or at mount for an element the
   * browser finished before hydration -- a cached hero never fires `load` for
   * the script, and a gate waiting on `onChosen` would otherwise hold it at
   * opacity 0 forever. */
  function settle(img: HTMLImageElement) {
    const url = current;
    if (!url) return;
    const key = `${generation}:${url}`;
    if (settledFor === key) return;
    settledFor = key;

    if (onFallback) {
      painted = true;
      return;
    }
    if (!accept(img, url)) {
      debug.warn(`Rejected decoded image: ${url}`);
      advance();
      return;
    }
    painted = true;
    debug.success(`Image loaded: ${url} (candidate ${index + 1}/${candidates.length})`);
    // What the browser actually chose, where it says: the phone source and
    // the desktop one differ, and callers key their treatment off the path.
    report({ src: img.currentSrc || url, reason: loadReason(index, candidates.length) });
  }

  function advance() {
    painted = false;
    if (index + 1 < candidates.length) {
      index += 1;
      return;
    }
    giveUp();
  }

  function giveUp() {
    failed = true;
    if (placeholderTitle) {
      // Nothing further to fetch: the panel is the final state.
      painted = true;
      report({ src: null, reason: 'placeholder' });
    } else {
      debug.error('All image sources failed, using fallback');
      report({ src: fallbackSrc || null, reason: 'all-failed' });
    }
  }

  function handleError() {
    if (onFallback) {
      // The fallback itself is broken; there is nothing left to try.
      painted = true;
      return;
    }
    debug.warn(`Image failed to load: ${current}`);
    advance();
  }

  function handleLoad(event: Event) {
    settle(event.currentTarget as HTMLImageElement);
  }

  function rewalk() {
    index = 0;
    failed = false;
    painted = false;
    settledFor = '';
    generation += 1;
  }

  // Candidate changes after the first render start the walk over with a fresh
  // element. The first run is the server's element: leaving it alone is what
  // keeps the SSR request from being thrown away at hydration.
  let prevKey: string | null = null;
  $effect(() => {
    const key = candidatesKey;
    if (prevKey === null) {
      prevKey = key;
      return;
    }
    if (key === prevKey) return;
    prevKey = key;
    debug.log('Image candidates changed; walking again');
    rewalk();
  });

  // A page with nothing to show reports that once, so a caller gating on
  // `onChosen` is not left waiting.
  $effect(() => {
    if (candidates.length > 0 || reportedEmpty) return;
    reportedEmpty = true;
    debug.warn('No image sources or src provided');
    giveUp();
  });

  // An element the browser already finished with before this ran.
  $effect(() => {
    const img = imgEl;
    const url = current;
    if (!img || !url || !img.complete) return;
    if (img.naturalWidth > 0) settle(img);
    else handleError();
  });

  // Optional per-candidate deadline.
  $effect(() => {
    const url = current;
    if (!perTryTimeoutMs || perTryTimeoutMs <= 0 || !url || painted) return;
    const t = setTimeout(() => {
      debug.warn(`Image timed out: ${url}`);
      if (onFallback) painted = true;
      else advance();
    }, perTryTimeoutMs);
    return () => clearTimeout(t);
  });

  // bfcache restores and mobile swipe-back can hand back a document whose
  // images never finished; a tab that was hidden mid-load can do the same.
  $effect(() => {
    const incomplete = () => {
      if (painted) return false;
      const img = imgEl;
      return !img || !img.complete || img.naturalWidth === 0;
    };
    const retry = () => {
      if (incomplete()) rewalk();
    };
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) retry();
    };
    const handleVisibilityChange = () => {
      if (!document.hidden) retry();
    };
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('swipe-navigation-restored', retry);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('swipe-navigation-restored', retry);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  });
</script>

<div class="relative {className}" {style}>
  {#if !painted && !showPlaceholder}
    <!-- Sits under the element until it has decoded. Decorative: a shelf of
         60 cards produced 60 polite live regions and prefixed every card's
         accessible name with "Loading...". The card's own title names it. -->
    <div class="absolute inset-0 bg-weeb-surface skeleton rounded" aria-hidden="true"></div>
  {/if}

  {#if showPlaceholder}
    <!-- Recedes instead of leading: the same ground a card sits on, with the
         title doing the identifying work the artwork cannot. -->
    <div class="art-placeholder" role="img" aria-label={alt || `${placeholderTitle} — no artwork available`}>
      <span class="art-placeholder__title">{placeholderTitle}</span>
    </div>
  {:else if current}
    {#key generation}
      {#if phoneCurrent}
        <picture class="relative block w-full h-full">
          <source media={PHONE_QUERY} srcset={phoneSrcset ?? phoneCurrent} sizes={phoneSrcset ? sizes : undefined} />
          {@render image()}
        </picture>
      {:else}
        {@render image()}
      {/if}
    {/key}
  {/if}
</div>

{#snippet image()}
  <!-- `relative` so the element paints above the positioned skeleton. No
       opacity gate: the server's element should show the moment it decodes,
       script or no script. -->
  <img
    bind:this={imgEl}
    src={current}
    srcset={currentSrcset ?? undefined}
    sizes={currentSrcset ? sizes : undefined}
    {alt}
    class="relative w-full h-full object-cover"
    {width}
    {height}
    loading={actualLoading}
    fetchpriority={priority ? 'high' : 'auto'}
    decoding="async"
    onerror={handleError}
    onload={handleLoad}
  />
{/snippet}

<style>
  .art-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: flex-end;
    padding: 12px;
    background: var(--weeb-surface);
  }
  .art-placeholder__title {
    font-family: var(--weeb-font);
    font-size: 13px;
    font-weight: 600;
    line-height: 1.3;
    /* fg-secondary, not fg-muted: muted measures 4.1:1 on this ground. */
    color: var(--weeb-fg-secondary);
    display: -webkit-box;
    -webkit-line-clamp: 4;
    line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
