<script lang="ts">
  import { onMount } from 'svelte';
  import Button from './Button.svelte';
  import AnimeActions from './AnimeActions.svelte';
  import SafeImage from './SafeImage.svelte';
  import StreamingPlatforms from './StreamingPlatforms.svelte';
  import { animeHref } from '../../services/utils';
  import { getSafeImageUrl } from '../utils/image';
  import type { EpisodeTiming } from '../../services/airTimeUtils';
  import { configStore } from '../stores/config';
  import { animeNotificationStore } from '../stores/animeNotifications';
  import { preferencesStore, getAnimeTitle } from '../stores/preferences';
  import { loggedInStore } from '../stores/auth';

  export let anime: any;
  /**
   * The episode timing resolved once in HomepageSSR.processCurrentlyAiring.
   * Null on the fallback banner (top-rated), which has no schedule at all.
   */
  export let timing: EpisodeTiming | null = null;

  let imageSources: string[] = [];
  let bgLoaded = false;
  let showJstPopover = false;
  let currentAnimeId: string | null = null;
  let supportsWebP = false;

  /**
   * TheTVDB banner art is roughly 16:9 and the hero is a 100svh box, so on a
   * phone the only way to cover that shape is to crop the banner to a narrow
   * vertical strip of itself -- usually a piece of background with the subject
   * outside the frame. A poster is 2:3 and fills a tall viewport natively. From
   * a tablet up the hero is wide enough for the banner to read as composed, so
   * it keeps priority there.
   *
   * Safe to decide on the client: SafeImage resolves its source after mount and
   * emits no <img> during SSR, so there is nothing to flash or swap.
   */
  const PHONE_QUERY = '(max-width: 767px)';
  let isPhone = false;

  // Get timing data from the shared anime notification store
  $: timingData = $animeNotificationStore.timingData[anime.id];
  $: workerCountdown = $animeNotificationStore.countdowns[anime.id];

  // Computed timing values (matching React HeroBanner logic)
  $: hasTimingData = Boolean(timingData || workerCountdown);
  $: airDateTime = timingData?.airDateTime || "";
  $: airingToday = timingData?.isAiringToday || false;
  $: currentlyAiring = timingData?.isCurrentlyAiring || workerCountdown?.isAiring || false;
  $: alreadyAired = timingData?.hasAlreadyAired || workerCountdown?.hasAired || false;
  $: countdown = timingData?.countdown || workerCountdown?.countdown || "";
  $: progress = timingData?.progress || workerCountdown?.progress;


  // Episode info from worker
  $: episode = timingData?.episode;
  $: episodeTitle = episode ? (episode.titleEn || episode.titleJp || "Next Episode") : (hasTimingData ? "Next Episode" : "No upcoming episodes");
  $: episodeNumber = episode?.episodeNumber ? `${episode.episodeNumber}` : "";

  // Check WebP support
  function checkWebPSupport(): Promise<boolean> {
    return new Promise((resolve) => {
      const webP = new Image();
      webP.onload = webP.onerror = () => resolve(webP.height === 2);
      webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
    });
  }

  // Initialize config on mount
  onMount(async () => {
    await configStore.init();

    // Check WebP support
    supportsWebP = await checkWebPSupport();
    console.log('🖼️ WebP support:', supportsWebP);
  });

  // Separate from the async onMount above: Svelte ignores a cleanup function
  // returned from an async callback, so the listener would never be removed.
  onMount(() => {
    const mq = window.matchMedia(PHONE_QUERY);
    isPhone = mq.matches;
    const onChange = (event: MediaQueryListEvent) => (isPhone = event.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  });

  // Generate ordered list of image sources to try
  function generateImageSources(phone: boolean): string[] {
    const sources: string[] = [];

    // Both are keyed by anime id: banners/<id> for the tvdb artwork synced by
    // thetvdb-enrichment, <id> at the root for the poster. Built through
    // getSafeImageUrl so they follow config.cdn_url. Hardcoding the host meant
    // local and staging read production artwork, which hid the fact that staging
    // had no banners of its own.
    if (anime.id) {
      // TheTVDB's 680x1000 series poster, synced by thetvdb-enrichment.
      const tvdbPoster = getSafeImageUrl(anime.id, 'posters');
      // TheTVDB's wide background artwork.
      const banner = getSafeImageUrl(anime.id, 'banners');
      // The scraper's MyAnimeList image at the bucket root -- 225px wide, so it
      // is the last resort at hero scale rather than a peer of the other two.
      const malImage = getSafeImageUrl(anime.id);

      if (phone) {
        // Tall box: prefer tall art, and prefer the high-resolution one.
        sources.push(tvdbPoster, malImage, banner);
      } else {
        // Wide box: the banner is composed for this shape. A poster cropped to
        // a wide frame still beats a 225px image blown up to fill it.
        sources.push(banner, tvdbPoster, malImage);
      }
    }

    return sources;
  }

  // Update sources when anime changes
  $: {
    if (currentAnimeId !== anime.id) {
      currentAnimeId = anime.id;
      bgLoaded = false;
      imageSources = generateImageSources(isPhone);
    }
  }

  // Regenerate sources when WebP support is detected
  $: if (supportsWebP && currentAnimeId === anime.id) {
    imageSources = generateImageSources(isPhone);
  }

  // ...and when the viewport crosses the breakpoint, so a rotate or a resized
  // window re-picks rather than keeping art chosen for the other shape.
  $: if (currentAnimeId === anime.id) {
    imageSources = generateImageSources(isPhone);
  }

  // A phone never needs 1600px of hero art.
  $: heroCdnWidth = isPhone ? 800 : 1600;

  $: title = getAnimeTitle(anime, $preferencesStore.titleLanguage);

  // Show titles range from "Chiikawa" to "The Exiled Heavy Knight Knows How to
  // Game the System". At one fixed Display size the long ones run to three lines
  // and shove the panel's top edge up by ~150px, which is visible as a jump when
  // the rail retargets the banner. Stepping the size by length keeps the panel
  // roughly one height. Computed during render, so SSR emits the final size and
  // there is no measure-then-resize flash.
  $: titleTier = title.length > 40 ? 'long' : title.length > 18 ? 'mid' : 'short';

  // Display values come from the resolved timing when there is one. The worker
  // store is kept only for `progress`, which nothing else computes; using it for
  // the countdown too is what put "18H" in the badge while the rail beside it
  // read "Airing in 19h" for the same episode.
  $: liveNow = timing ? timing.isLive : currentlyAiring;
  $: airedAlready = timing ? timing.hasAired : alreadyAired;
  $: badgeCountdown = timing ? timing.countdown : countdown;
  $: hasSchedule = Boolean(timing) || hasTimingData;

  // "Airing Soon" was attached to anything neither airing nor already aired, so
  // it shipped over an episode nineteen hours away. Soon has to mean soon; past
  // a few hours the honest label is just what the thing is.
  const SOON_MS = 6 * 60 * 60 * 1000;
  $: upcomingLabel = timing && timing.airDateTime.getTime() - Date.now() <= SOON_MS
    ? 'Airing Soon'
    : 'Next Episode';

  function handleImageChosen(event: CustomEvent) {
    console.log('🖼️ HeroBanner image chosen:', event.detail);
    bgLoaded = true;
  }

</script>

<div class="hero">
  {#if imageSources.length > 0}
    <div class="hero-bg-image" style="opacity: {bgLoaded ? 1 : 0};">
      <SafeImage
        sources={imageSources}
        alt=""
        loading="eager"
        priority={true}
        fallbackSrc="/assets/not found.jpg"
        perTryTimeoutMs={3000}
        className="hero-bg-cover"
        cdnWidth={heroCdnWidth}
        on:chosen={handleImageChosen}
      />
    </div>
  {/if}

  <!-- Only the nav band keeps a scrim; it is what makes a transparent bar safe
       over key art of unknown colour. Everything below sits in a container. -->
  <div class="hero-scrim-top"></div>
  <div class="hero-scrim-bottom"></div>

  <!-- Content -->
  <div class="hero-content">
    {#if hasSchedule && liveNow}
      <div class="hero-badge hero-badge--progress" style="--progress-factor: {progress !== undefined ? progress : 0};">
        <span class="badge-track"></span>
        <span class="badge-label"><span class="dot"></span> Currently Airing</span>
        {#if badgeCountdown}
          <span class="badge-countdown">{badgeCountdown}</span>
        {/if}
      </div>
    {:else if hasSchedule && !liveNow && !airedAlready}
      <div class="hero-badge">
        <span class="badge-label"><span class="dot"></span> {upcomingLabel}</span>
        {#if badgeCountdown && badgeCountdown !== "AIRING NOW" && !badgeCountdown.includes("JUST")}
          <span class="badge-countdown">{badgeCountdown}</span>
        {/if}
      </div>
    {:else if hasSchedule && airedAlready}
      <div class="hero-badge" style="background: var(--weeb-green);">
        <span class="badge-label"><span class="dot" style="background: white;"></span> Recently Aired</span>
      </div>
    {/if}

    <!-- h2, not h1: this is one rotating featured item, so as an h1 the homepage's
         primary heading changed with whatever the carousel happened to show. The
         page-level h1 lives in HomepageSSR. -->
    <h2 class="t-{titleTier}">{title}</h2>

    {#if anime.description}
      <p class="hero-desc">{anime.description}</p>
    {/if}

    <div class="hero-meta">
      {#if episodeNumber}
        <span>Episode {episodeNumber}</span>
      {/if}
      {#if timing}
        <span class="air-time"
          >Airs {timing.localTime}{#if timing.localZone}&nbsp;<span class="air-time-zone"
            >{timing.localZone}</span
          >{/if}</span
        >
        {#if timing.broadcastSlot}
          <button
            type="button"
            class="tz-toggle"
            aria-expanded={showJstPopover}
            aria-controls="hero-broadcast-slot"
            on:click={() => (showJstPopover = !showJstPopover)}>Broadcast time</button
          >
        {/if}
      {:else if anime.broadcast}
        <span class="air-time">{anime.broadcast}</span>
      {/if}
      {#if showJstPopover && timing?.broadcastSlot}
        <p class="tz-popover" id="hero-broadcast-slot">
          Broadcast slot: {timing.broadcastSlot}. Times above are in your local timezone.
        </p>
      {/if}
    </div>

    <div class="hero-platforms">
      <StreamingPlatforms platforms={anime.streamingPlatforms} />
    </div>

    <div class="hero-actions">
      <a href={animeHref(anime)} class="btn-primary">View Details</a>
      <AnimeActions
        {anime}
        variant="hero"
      />
    </div>

    <!-- Nowhere on the homepage did it say what an account is for, so "Add to
         List" read as a wall rather than an offer. One line, only while signed
         out, and only once auth has resolved so it does not flash at returning
         visitors. Claims nothing the product does not already do. -->
    {#if $loggedInStore.isAuthInitialized && !$loggedInStore.isLoggedIn}
      <p class="hero-value">Free account &mdash; track every episode and get notified the moment one airs.</p>
    {/if}
  </div>

</div>

<style>
  .hero {
    position: relative;
    min-height: calc(100svh + var(--hero-fade, 0px));
    display: flex;
    align-items: flex-end;
    background: var(--weeb-bg-elevated);
  }
  /* Sits behind the transparent nav. Short, and gone well before the artwork's
     focal band. */
  .hero-scrim-top {
    position: absolute;
    inset: 0 0 auto 0;
    height: 180px;
    z-index: 2;
    background: linear-gradient(
      to bottom,
      color-mix(in oklch, var(--weeb-bg) 88%, transparent) 0%,
      color-mix(in oklch, var(--weeb-bg) 50%, transparent) 40%,
      transparent 100%
    );
  }
  .hero-bg-image {
    position: absolute;
    inset: 0;
    z-index: 1;
    overflow: hidden;
    transition: opacity 500ms;
  }
  .hero-bg-image :global(.hero-bg-cover),
  .hero-bg-image :global(.hero-bg-cover img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center 20%;
    display: block;
  }
  /* Starts fully transparent above the fold, so none of it shows at rest; the
     artwork dissolves into the page ground only as it scrolls past. */
  .hero-scrim-bottom {
    position: absolute;
    inset: auto 0 0 0;
    /* Exactly the below-fold band: its top edge sits on the fold, where the
       gradient is still fully transparent, so nothing of it is visible at rest. */
    height: var(--hero-fade, 0px);
    z-index: 2;
    /* Smoothstep, not a linear ramp. A two-stop gradient begins fading at a
       constant slope the instant it starts, and the eye reads that abrupt onset
       as a horizontal seam (Mach band). These stops approximate t^2(3-2t), so the
       fade starts at almost zero slope and there is no line where it begins. */
    background: linear-gradient(
      to bottom,
      transparent 0%,
      color-mix(in oklch, var(--weeb-bg) 6%, transparent) 15%,
      color-mix(in oklch, var(--weeb-bg) 22%, transparent) 30%,
      color-mix(in oklch, var(--weeb-bg) 43%, transparent) 45%,
      color-mix(in oklch, var(--weeb-bg) 65%, transparent) 60%,
      color-mix(in oklch, var(--weeb-bg) 84%, transparent) 75%,
      color-mix(in oklch, var(--weeb-bg) 97%, transparent) 90%,
      var(--weeb-bg) 100%
    );
  }

  .hero-content {
    position: relative;
    z-index: 3;
    margin: 0 0 calc(32px + var(--hero-fade, 0px)) 32px;
    padding: 20px;
    background: var(--weeb-panel-bg, var(--weeb-surface));
    backdrop-filter: var(--weeb-panel-blur);
    -webkit-backdrop-filter: var(--weeb-panel-blur);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius-lg, 12px);
    box-shadow: var(--weeb-shadow-card, 0 12px 32px oklch(0% 0 0 / 0.4));
  }
  .hero-badge {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 20px;
    background: var(--weeb-accent);
    color: white;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 16px;
    overflow: hidden;
  }
  .hero-badge--progress {
    background: var(--weeb-surface-hover);
    padding: 6px 14px;
  }
  .badge-track {
    position: absolute;
    inset: 0;
    width: 100%;
    transform: scaleX(var(--progress-factor, 0));
    transform-origin: left center;
    background: var(--weeb-accent);
    border-radius: 20px;
    transition: transform 1s ease-out;
  }
  .badge-label {
    position: relative;
    z-index: 1;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--weeb-green);
    animation: pulse 2s infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
  @media (prefers-reduced-motion: reduce) {
    .dot { animation: none; }
    .badge-track { transition: none; }
  }
  .badge-countdown {
    position: relative;
    z-index: 1;
    margin-left: 4px;
    padding: 1px 6px;
    border-radius: var(--weeb-radius-sm, 4px);
    background: color-mix(in oklch, var(--weeb-bg) 45%, transparent);
    font-family: var(--weeb-font-mono);
    font-size: 12px;
    letter-spacing: 0.02em;
  }
  .hero h2 {
    font-weight: 800;
    letter-spacing: -0.02em;
    /* 1.1 per the Display spec; at 44px the extra 0.05 cost a visible band of
       height on the three-line titles this catalogue is full of. */
    line-height: 1.1;
    margin: 0 0 12px;
    color: var(--weeb-fg);
    /* Show titles run long and arbitrary. Balancing stops the last line
       collapsing to a single orphaned word. */
    text-wrap: balance;
  }
  .hero h2.t-short { font-size: clamp(28px, 4vw, 44px); }
  .hero h2.t-mid   { font-size: clamp(26px, 3.2vw, 36px); }
  .hero h2.t-long  { font-size: clamp(24px, 2.6vw, 30px); }

  /* A long title has already spent the panel's vertical budget; the synopsis
     gives a line back so the panel does not grow twice over. */
  .hero h2.t-long ~ .hero-desc {
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }
  .hero-desc {
    display: none;
    /* Body scale per DESIGN.md; 15px read as a second headline next to the
       title rather than supporting text. */
    font-size: 14px;
    line-height: 1.6;
    color: var(--weeb-fg-secondary);
    max-width: 60ch;
    margin: 0 0 16px;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .hero-meta {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    font-family: var(--weeb-font-mono);
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.02em;
    color: var(--weeb-fg);
  }
  /* The zone abbreviation is a measured value, so it stays in the mono column
     the rest of .hero-meta already sets; only the colour steps back. */
  .air-time-zone {
    color: var(--weeb-fg-secondary);
  }
  .tz-toggle {
    position: relative;
    font: inherit;
    color: var(--weeb-fg-secondary);
    background: none;
    border: 0;
    border-bottom: 1px dashed var(--weeb-border);
    padding: 0 0 1px;
    cursor: pointer;
    transition: color 0.15s ease, border-color 0.15s ease;
  }
  .tz-toggle::after {
    content: '';
    position: absolute;
    inset: -13px -8px;
  }
  .tz-toggle:hover {
    color: var(--weeb-fg);
    border-bottom-color: var(--weeb-fg-secondary);
  }
  .tz-toggle:focus-visible {
    outline: 2px solid var(--weeb-accent-text);
    outline-offset: 3px;
    border-radius: var(--weeb-radius-sm);
  }
  .tz-popover {
    flex-basis: 100%;
    margin: 0;
    color: var(--weeb-fg-secondary);
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius);
    box-shadow: var(--weeb-shadow-dropdown);
    padding: 8px 12px;
  }
  .hero-value {
    margin: 10px 0 0;
    font-size: 12px;
    line-height: 1.5;
    /* fg-secondary, not fg-muted: muted measures 4.1:1 on this ground and this
       is the one line asking for the account. */
    color: var(--weeb-fg-secondary);
  }
  .hero-actions {
    display: flex;
    gap: 10px;
    margin-top: 20px;
    align-items: center;
  }
  .btn-primary {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 10px 24px;
    border-radius: var(--weeb-radius, 8px);
    font-size: 14px;
    font-weight: 600;
    background: var(--weeb-accent);
    color: white;
    text-decoration: none;
    transition: background 0.15s;
  }
  .btn-primary:hover {
    background: var(--weeb-accent-hover);
  }
  @media (min-width: 1025px) {
    .hero-desc { display: -webkit-box; }
    /* Keeps the text column clear of the rail. Desktop only: below this width
       the rail is a tray under the panel, and the subtraction would go negative. */
    .hero-content { max-width: min(560px, calc(100vw - 470px)); }
  }

  @media (max-width: 1024px) {
    /* The airing tray sits across the base of the banner below this container. */
    .hero-content {
      margin: 0 12px calc(168px + var(--hero-fade, 0px));
      /* Flex item in a row container: it shrinks to its content and stops short
         of its own right margin, which reads as a broken box on a phone. flex
         grows it along the main axis; align-self would only stretch height. */
      flex: 1 1 auto;
    }
  }

  @media (max-width: 768px) {
    /* Streaming platforms are still on the show page; here the room goes to the
       schedule, which is what the visitor came for. */
    .hero-platforms { display: none; }
    .hero-scrim-top { height: 120px; }
  }

  @media (max-width: 480px) {
    .hero-content { padding: 16px; }
  }
</style>
