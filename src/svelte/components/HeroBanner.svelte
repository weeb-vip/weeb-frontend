<script lang="ts">
  import AnimeActions from './AnimeActions.svelte';
  import SafeImage from './SafeImage.svelte';
  import StreamingPlatforms from './StreamingPlatforms.svelte';
  import { animeHref } from '../../services/utils';
  import type { EpisodeTiming } from '../../services/airTimeUtils';
  import { HeroBannerBloc } from './HeroBanner.bloc.svelte';

  let {
    anime,
    timing = null,
    bloc: injected
  }: {
    anime: any;
    /**
     * The episode timing resolved once in HomepageSSR.processCurrentlyAiring.
     * Null on the fallback banner (top-rated), which has no schedule at all.
     */
    timing?: EpisodeTiming | null;
    bloc?: HeroBannerBloc;
  } = $props();

  const ownBloc = new HeroBannerBloc({
    get anime() {
      return anime;
    },
    get timing() {
      return timing;
    }
  });
  const bloc = $derived(injected ?? ownBloc);

  // Config, the WebP probe and the phone breakpoint. All three were onMounts;
  // the media listener is the one with a teardown, and it now has one.
  $effect(() => bloc.init());
</script>

<div class="hero">
  {#if bloc.imageSources.length > 0}
    <div class="hero-bg-image" style="opacity: {bloc.bgLoaded ? 1 : 0};">
      <SafeImage
        sources={bloc.imageSources}
        alt=""
        loading="eager"
        priority={true}
        fallbackSrc="/assets/not found.jpg"
        perTryTimeoutMs={3000}
        className="hero-bg-cover"
        cdnWidth={bloc.heroCdnWidth}
        onChosen={() => bloc.imageChosen()}
      />
    </div>
  {/if}

  <!-- Only the nav band keeps a scrim; it is what makes a transparent bar safe
       over key art of unknown colour. Everything below sits in a container. -->
  <div class="hero-scrim-top"></div>
  <div class="hero-scrim-bottom"></div>

  <!-- Content -->
  <div class="hero-content">
    {#if bloc.hasSchedule && bloc.liveNow}
      <div class="hero-badge hero-badge--progress" style="--progress-factor: {bloc.progress !== undefined ? bloc.progress : 0};">
        <span class="badge-track"></span>
        <span class="badge-label"><span class="dot"></span> Currently Airing</span>
        {#if bloc.badgeCountdown}
          <span class="badge-countdown">{bloc.badgeCountdown}</span>
        {/if}
      </div>
    {:else if bloc.hasSchedule && !bloc.liveNow && !bloc.airedAlready}
      <div class="hero-badge">
        <span class="badge-label"><span class="dot"></span> {bloc.upcomingLabel}</span>
        {#if bloc.showUpcomingCountdown}
          <span class="badge-countdown">{bloc.badgeCountdown}</span>
        {/if}
      </div>
    {:else if bloc.hasSchedule && bloc.airedAlready}
      <div class="hero-badge" style="background: var(--weeb-green);">
        <span class="badge-label"><span class="dot" style="background: white;"></span> Recently Aired</span>
      </div>
    {/if}

    <!-- h2, not h1: this is one rotating featured item, so as an h1 the homepage's
         primary heading changed with whatever the carousel happened to show. The
         page-level h1 lives in HomepageSSR. -->
    <h2 class="t-{bloc.titleTier}">{bloc.title}</h2>

    {#if bloc.description}
      <p class="hero-desc">{bloc.description}</p>
    {/if}

    <div class="hero-meta">
      {#if bloc.episodeNumber}
        <span>Episode {bloc.episodeNumber}</span>
      {/if}
      {#if bloc.timing}
        <span class="air-time"
          >Airs {bloc.timing.localTime}{#if bloc.timing.localZone}&nbsp;<span class="air-time-zone"
            >{bloc.timing.localZone}</span
          >{/if}</span
        >
        {#if bloc.timing.broadcastSlot}
          <button
            type="button"
            class="tz-toggle"
            aria-expanded={bloc.showJstPopover}
            aria-controls="hero-broadcast-slot"
            onclick={() => bloc.toggleJstPopover()}>Broadcast time</button
          >
        {/if}
      {:else if bloc.anime.broadcast}
        <span class="air-time">{bloc.anime.broadcast}</span>
      {/if}
      {#if bloc.showJstPopover && bloc.timing?.broadcastSlot}
        <p class="tz-popover" id="hero-broadcast-slot">
          Broadcast slot: {bloc.timing.broadcastSlot}. Times above are in your local timezone.
        </p>
      {/if}
    </div>

    <div class="hero-platforms">
      <StreamingPlatforms platforms={bloc.anime.streamingPlatforms} />
    </div>

    <div class="hero-actions">
      <a href={animeHref(bloc.anime)} class="btn-primary">View Details</a>
      <AnimeActions
        anime={bloc.anime}
        variant="hero"
      />
    </div>

    <!-- Nowhere on the homepage did it say what an account is for, so "Add to
         List" read as a wall rather than an offer. One line, only while signed
         out, and only once auth has resolved so it does not flash at returning
         visitors. Claims nothing the product does not already do. -->
    {#if bloc.showSignUpLine}
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
