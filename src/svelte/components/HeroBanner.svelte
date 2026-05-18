<script lang="ts">
  import { onMount } from 'svelte';
  import { format } from 'date-fns';
  import Button from './Button.svelte';
  import AnimeActions from './AnimeActions.svelte';
  import SafeImage from './SafeImage.svelte';
  import { GetImageFromAnime } from '../../services/utils';
  import { findNextEpisode, parseAirTime, getAirDateTime } from '../../services/airTimeUtils';
  import { configStore } from '../stores/config';
  import { animeCountdownStore } from '../stores/animeCountdown';
  import { preferencesStore, getAnimeTitle } from '../stores/preferences';

  export let anime: any;

  let imageSources: string[] = [];
  let bgLoaded = false;
  let showJstPopover = false;
  let currentAnimeId: string | null = null;
  let supportsWebP = false;

  // Get timing data from the anime countdown store
  $: timingData = $animeCountdownStore.timingData[anime.id];
  $: workerCountdown = $animeCountdownStore.countdowns[anime.id];

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

  // Generate ordered list of image sources to try
  function generateImageSources(): string[] {
    const sources: string[] = [];

    const baseParams = new URLSearchParams({
      w: '1920',  // Max width for hero banners
      h: '1080',  // Max height for hero banners
      fit: 'cover',
      q: '85'     // High quality for hero images
    });

    if (supportsWebP) {
      baseParams.set('f', 'webp');
    }

    // Priority 1: TVDB fanart (highest quality)
    if (anime.thetvdbid) {
      const baseUrl = `https://weeb-api.staging.weeb.vip/show/anime/series/${anime.thetvdbid}/fanart`;
      sources.push(`${baseUrl}?${baseParams.toString()}`);
    }

    // Priority 2: AniDB fanart
    if (anime.anidbid) {
      const baseUrl = `https://weeb-api.staging.weeb.vip/show/anime/anidb/series/${anime.anidbid}/fanart`;
      sources.push(`${baseUrl}?${baseParams.toString()}`);
    }

    // Priority 3: CDN poster as fallback
    const posterUrl = GetImageFromAnime(anime);
    if (posterUrl) {
      sources.push(`https://cdn.weeb.vip/weeb/${encodeURIComponent(posterUrl)}`);
    }

    return sources;
  }

  // Update sources when anime changes
  $: {
    if (currentAnimeId !== anime.id) {
      currentAnimeId = anime.id;
      bgLoaded = false;
      imageSources = generateImageSources();
      console.log('🖼️ Generated image sources for', anime.id, ':', imageSources);
    }
  }

  // Regenerate sources when WebP support is detected
  $: if (supportsWebP && currentAnimeId === anime.id) {
    imageSources = generateImageSources();
  }

  $: title = getAnimeTitle(anime, $preferencesStore.titleLanguage);

  // For now, we'll use a simpler approach without the worker data
  // This can be enhanced later with Svelte stores for countdown data
  const animeNextEpisodeInfo = anime.nextEpisode && (anime.nextEpisode.airDate || anime.nextEpisode.airTime) ? {
    episode: anime.nextEpisode,
    airTime: anime.nextEpisode.airTime ? new Date(anime.nextEpisode.airTime) : new Date(anime.nextEpisode.airDate)
  } : null;
  const airTimeAndDate = parseAirTime(animeNextEpisodeInfo?.episode.airDate, anime.broadcast);

  function handleImageChosen(event: CustomEvent) {
    console.log('🖼️ HeroBanner image chosen:', event.detail);
    bgLoaded = true;
  }

</script>

<div class="hero">
  <!-- Background layer -->
  <div class="hero-bg-animated"></div>

  {#if imageSources.length > 0}
    <div class="hero-bg-image" style="opacity: {bgLoaded ? 1 : 0};">
      <SafeImage
        sources={imageSources}
        alt="Anime background"
        loading="eager"
        priority={true}
        fallbackSrc="/assets/not found.jpg"
        perTryTimeoutMs={3000}
        className="hero-bg-cover"
        on:chosen={handleImageChosen}
      />
    </div>
  {/if}

  <div class="hero-overlay"></div>

  <!-- Content -->
  <div class="hero-content">
    {#if hasTimingData && currentlyAiring}
      <div class="hero-badge hero-badge--progress" style="--progress: {progress !== undefined ? Math.round(progress * 100) : 0}%;">
        <span class="badge-track"></span>
        <span class="badge-label"><span class="dot"></span> Currently Airing</span>
        {#if countdown}
          <span class="badge-countdown">{countdown}</span>
        {/if}
      </div>
    {:else if hasTimingData && !currentlyAiring && !alreadyAired}
      <div class="hero-badge">
        <span class="badge-label"><span class="dot"></span> Airing Soon</span>
        {#if countdown && countdown !== "AIRING NOW" && !countdown.includes("JUST")}
          <span class="badge-countdown">{countdown}</span>
        {/if}
      </div>
    {:else if hasTimingData && alreadyAired}
      <div class="hero-badge" style="background: var(--weeb-green);">
        <span class="badge-label"><span class="dot" style="background: white;"></span> Recently Aired</span>
      </div>
    {/if}

    <h1>{title}</h1>

    {#if anime.description}
      <p class="hero-desc">
        {anime.description.length > 250
          ? `${anime.description.substring(0, 250)}...`
          : anime.description}
      </p>
    {/if}

    <div class="hero-meta">
      {#if anime.tags && anime.tags.length > 0}
        {#each anime.tags.slice(0, 3) as tag}
          <span class="tag">{tag}</span>
        {/each}
      {/if}
      {#if episodeNumber}
        <span>Episode {episodeNumber}</span>
      {/if}
      {#if airTimeAndDate}
        <span class="air-time">Airs {format(airTimeAndDate, "EEE h:mm a")}</span>
      {:else if anime.broadcast}
        <span class="air-time">{anime.broadcast}</span>
      {/if}
    </div>

    <div class="hero-actions">
      <a href="/show/{anime.id}" class="btn-primary">View Details</a>
      <AnimeActions
        {anime}
        variant="hero"
        statusKey="hero-{anime.id}"
      />
    </div>
  </div>

  <!-- Poster card -->
  <div class="hero-poster">
    <SafeImage
      src={GetImageFromAnime(anime)}
      alt={title}
      className="hero-poster-img"
      fallbackSrc="/assets/not found.jpg"
    />
  </div>
</div>

<style>
  .hero {
    position: relative;
    min-height: 720px;
    display: flex;
    align-items: flex-end;
  }
  .hero-bg-animated {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, oklch(22% 0.04 280), oklch(14% 0.02 260), oklch(16% 0.03 300));
    background-size: 400% 400%;
    animation: heroShift 20s ease infinite;
    z-index: 0;
  }
  @keyframes heroShift {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
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
  .hero-overlay {
    position: absolute;
    inset: 0;
    z-index: 2;
    background:
      linear-gradient(to top, var(--weeb-bg) 0%, oklch(14% 0.015 275 / 0.85) 40%, oklch(14% 0.015 275 / 0.55) 70%, oklch(14% 0.015 275 / 0.3) 100%),
      linear-gradient(to right, oklch(14% 0.015 275 / 0.7) 0%, transparent 60%);
  }
  .hero-content {
    position: relative;
    z-index: 3;
    padding: 0 48px 48px;
    max-width: 640px;
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
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 16px;
    overflow: hidden;
  }
  .hero-badge--progress {
    background: oklch(30% 0.04 275);
    padding: 6px 14px;
  }
  .badge-track {
    position: absolute;
    inset: 0;
    width: var(--progress, 0%);
    background: var(--weeb-accent);
    border-radius: 20px;
    transition: width 1s ease-out;
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
  .badge-countdown {
    position: relative;
    z-index: 1;
    margin-left: 4px;
    padding: 1px 6px;
    border-radius: 4px;
    background: oklch(0% 0 0 / 0.25);
    font-size: 10px;
  }
  .hero h1 {
    font-size: clamp(28px, 4vw, 44px);
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.15;
    margin: 0 0 12px;
    color: var(--weeb-fg);
  }
  .hero-desc {
    font-size: 15px;
    color: var(--weeb-fg-secondary);
    line-height: 1.6;
    max-width: 480px;
    margin: 0 0 16px;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .hero-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    font-size: 13px;
    color: var(--weeb-fg-muted);
  }
  .tag {
    padding: 3px 8px;
    border-radius: 4px;
    background: var(--weeb-surface);
    font-size: 12px;
    color: var(--weeb-fg-secondary);
  }
  .air-time {
    color: var(--weeb-accent);
    font-weight: 500;
  }
  .hero-actions {
    display: flex;
    gap: 10px;
    margin-top: 20px;
    align-items: center;
  }
  .btn-primary {
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
  .hero-poster {
    position: absolute;
    right: 48px;
    bottom: 48px;
    z-index: 3;
    width: 200px;
    height: 290px;
    border-radius: var(--weeb-radius-lg, 12px);
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    overflow: hidden;
    box-shadow: 0 20px 60px oklch(0% 0 0 / 0.5);
  }
  .hero-poster :global(.hero-poster-img),
  .hero-poster :global(.hero-poster-img img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  @media (max-width: 1024px) {
    .hero-poster { display: none; }
    .hero-content { padding: 0 24px 32px; }
  }
  @media (max-width: 768px) {
    .hero { min-height: 560px; }
    .hero h1 { font-size: 24px; }
  }
  @media (max-width: 480px) {
    .hero-content { padding: 0 16px 24px; }
    .hero { min-height: 480px; }
  }
</style>
