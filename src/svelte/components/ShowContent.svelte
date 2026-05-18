<script lang="ts">
  import { onMount } from 'svelte';
  import { format } from 'date-fns';
  import { createQuery } from '@tanstack/svelte-query';
  import SafeImage from './SafeImage.svelte';
  import AnimeActions from './AnimeActions.svelte';
  import Tag from './Tag.svelte';
  import Episodes from './Episodes.svelte';
  import CharactersWithStaff from './CharactersWithStaff.svelte';
  import { fetchDetails } from '../../services/queries';
  import { GetImageFromAnime, getYearUTC, formatDateUTC } from '../../services/utils';
  import { findNextEpisode, getCurrentTime, getAirTimeDisplay, parseDurationToMinutes, parseAirTime, getAirDateTime } from '../../services/airTimeUtils';
  import debug from '../../utils/debug';
  import { animeNotificationStore } from '../stores/animeNotifications';
  import ShowContentSkeleton from './ShowContentSkeleton.svelte';
  import { preferencesStore, getAnimeTitle } from '../stores/preferences';

  // Subscribe to preferences for reactive title updates
  $: preferences = $preferencesStore;
  $: animeTitle = anime ? getAnimeTitle(anime, preferences.titleLanguage) : '';
  export let animeId: string;
  export let ssrAnimeData: any = null;
  export let ssrCharactersData: any = null;
  export let ssrError: any = null;

  let imageSources: string[] = [];
  let bgLoaded = false;
  let showStickyHeader = false;
  let supportsWebP = false;
  let useFallback = false;
  let previousAnimeId: string | null = null; // Track anime ID changes

  // DOM refs
  let tabBarEl: HTMLElement;

  // Floating tab bar state
  let activeTab = 'synopsis';
  let showTabBar = false;
  let synopsisEl: HTMLElement;
  let episodesEl: HTMLElement;
  let charactersEl: HTMLElement;

  function scrollToSection(id: string) {
    const el = id === 'synopsis' ? synopsisEl : id === 'episodes' ? episodesEl : charactersEl;
    if (el) {
      const navHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--weeb-nav-height') || '60');
      const stickyOffset = showStickyHeader ? 72 : 0;
      const tabBarHeight = 48;
      const top = el.getBoundingClientRect().top + window.scrollY - navHeight - stickyOffset - tabBarHeight - 8;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }

  function handleTabScroll() {
    const navHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--weeb-nav-height') || '60');
    const offset = navHeight + 60;

    // Sticky header visibility
    handleStickyHeader();

    // On mobile: always show tab bar; on desktop: show after scrolling past hero
    const isMobile = window.innerWidth < 768;
    showTabBar = isMobile || window.scrollY > 400;

    // Determine active tab based on scroll position
    if (charactersEl && charactersEl.getBoundingClientRect().top < offset + 100) {
      activeTab = 'characters';
    } else if (episodesEl && episodesEl.getBoundingClientRect().top < offset + 100) {
      activeTab = 'episodes';
    } else {
      activeTab = 'synopsis';
    }
  }

  // Data state variables
  let showQueryStore: any = null;
  let showQuery: any = null;
  let show: any = null;
  let anime: any = null;
  let isLoading = true;
  let isError = false;
  let charactersData: any = null;

  // Initialize data from SSR if available
  if (ssrAnimeData) {
    show = ssrAnimeData;
    anime = ssrAnimeData.anime;
    isLoading = false;
    isError = false;
    console.log('🏃‍♂️ [ShowContent] Using SSR anime data');
  }

  if (ssrCharactersData) {
    charactersData = ssrCharactersData;
    console.log('🏃‍♂️ [ShowContent] Using SSR characters data');
  }

  if (ssrError) {
    isError = true;
    isLoading = false;
    console.error('🏃‍♂️ [ShowContent] SSR error:', ssrError);
  }

  // Create query at top level (required for Svelte lifecycle)
  showQueryStore = createQuery(fetchDetails(animeId));

  // Subscribe to query changes
  showQuery = $showQueryStore;

  // Update local state from query — preserve userAnime from SSR to prevent flicker
  $: if ($showQueryStore.data) {
    show = $showQueryStore.data;
    const newAnime = show?.anime;
    // If SSR gave us userAnime but the client refetch didn't, keep the SSR value
    if (newAnime && anime?.userAnime && !newAnime.userAnime) {
      newAnime.userAnime = anime.userAnime;
    }
    anime = newAnime;
    // Only update loading/error if we don't have SSR data
    if (!ssrAnimeData) {
      isLoading = $showQueryStore.isLoading;
      isError = $showQueryStore.isError;
    }
  }

  // Check WebP support
  function checkWebPSupport(): Promise<boolean> {
    return new Promise((resolve) => {
      const webP = new Image();
      webP.onload = webP.onerror = () => resolve(webP.height === 2);
      webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
    });
  }

  let scrollListenerAttached = false;

  function attachScrollListeners() {
    if (scrollListenerAttached) return;
    scrollListenerAttached = true;
    handleTabScroll();
    window.addEventListener('scroll', handleTabScroll, { passive: true });
    window.addEventListener('resize', handleTabScroll, { passive: true });
  }

  function detachScrollListeners() {
    if (!scrollListenerAttached) return;
    scrollListenerAttached = false;
    window.removeEventListener('scroll', handleTabScroll);
    window.removeEventListener('resize', handleTabScroll);
  }

  onMount(() => {
    // Check WebP support (async, but don't block cleanup return)
    checkWebPSupport().then(result => {
      supportsWebP = result;
    });

    // Attach scroll listeners
    attachScrollListeners();

    // Listen for Astro ViewTransition page loads
    function onPageLoad() {
      setTimeout(() => {
        attachScrollListeners();
        handleTabScroll();
      }, 100);
    }
    document.addEventListener('astro:page-load', onPageLoad);

    // Cleanup
    return () => {
      detachScrollListeners();
      document.removeEventListener('astro:page-load', onPageLoad);
    };
  });

  // Reactive failsafe: when anime data changes (new page), ensure listeners are attached
  $: if (anime && typeof window !== 'undefined') {
    setTimeout(() => {
      if (!scrollListenerAttached) {
        attachScrollListeners();
      }
    }, 200);
  }

  // Svelte action to portal element to body (survives ViewTransitions because
  // portal physically moves the DOM node out of the component tree)
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
      }
    };
  }

  // Get the first image source for sticky header background
  $: firstSource = imageSources.length > 0 ? imageSources[0] : '';

  // Generate ordered list of image sources to try
  function generateImageSources(): string[] {
    if (!anime) return [];

    const sources: string[] = [];

    const baseParams = new URLSearchParams({
      w: '1920',
      h: '1080',
      fit: 'cover',
      q: '85'
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

  // Update sources when anime ID changes (different show)
  $: if (anime) {
    const currentAnimeId = anime.id;
    const isNewAnime = currentAnimeId !== previousAnimeId;

    if (isNewAnime) {
      console.log('🖼️ New anime detected, resetting bgLoaded');
      bgLoaded = false;
      previousAnimeId = currentAnimeId;
    } else {
      console.log('🖼️ Same anime, data updated - NOT resetting bgLoaded');
    }

    imageSources = generateImageSources();
    console.log('🖼️ Generated image sources for', anime.id, ':', imageSources);
  }

  // Regenerate sources when WebP support is detected
  $: if (supportsWebP && anime) {
    console.log('🖼️ WebP support detected, regenerating sources but NOT resetting bgLoaded');
    imageSources = generateImageSources();
  }

  function handleImageChosen(event: CustomEvent) {
    console.log('🖼️ ShowContent background image chosen:', event.detail);
    bgLoaded = true;
    console.log('🖼️ bgLoaded set to true, wrapper should be visible now');
  }

  // Find next episode
  const now = getCurrentTime();
  $: nextEpisodeResult = anime?.episodes && anime.broadcast
    ? findNextEpisode(anime.episodes, anime.broadcast, now)
    : null;
  $: nextEpisode = nextEpisodeResult?.episode;

  // Calculate air time display and status
  $: airTimeDisplay = nextEpisode && anime ? getAirTimeDisplay(nextEpisode.airDate, anime.broadcast, parseDurationToMinutes(anime.duration)) : null;
  $: airTime = nextEpisodeResult?.airTime;

  $: statusConfig = {
    airing: { color: 'text-weeb-amber', text: 'Airing', icon: 'fa-clapperboard' },
    aired: { color: 'text-weeb-green', text: 'Recently Aired', icon: 'fa-calendar' },
    countdown: { color: 'text-weeb-red', text: 'Airing Soon', icon: 'fa-clock' },
    scheduled: { color: 'text-weeb-accent', text: 'Next Episode', icon: 'fa-calendar' }
  };

  // Hero banner style timing data (from notification store)
  $: timingDataStore = anime?.id ? animeNotificationStore.getTimingData(anime.id) : null;
  $: countdownStore = anime?.id ? animeNotificationStore.getCountdown(anime.id) : null;
  $: timingData = timingDataStore ? $timingDataStore : null;
  $: workerCountdown = countdownStore ? $countdownStore : null;

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

  // JST popover state
  let showJstPopover = false;

  // For fallback air time calculation (same as hero banner)
  $: animeNextEpisodeInfo = anime ? findNextEpisode(anime.episodes, anime.broadcast) : null;
  $: airTimeAndDate = animeNextEpisodeInfo ? parseAirTime(animeNextEpisodeInfo?.episode.airDate, anime.broadcast) : null;

  $: status = airTimeDisplay?.variant || 'scheduled';
  $: config = statusConfig[status] || statusConfig.scheduled;

  // Sticky header visibility — only tracks state for scrollToSection offset calculation.
  // The actual DOM element + scroll toggle lives in [id].astro (pure vanilla JS, survives ViewTransitions).
  function handleStickyHeader() {
    const shouldShow = window.scrollY > 350;
    showStickyHeader = shouldShow;

    // Directly update tab bar top offset via vanilla JS (Svelte reactivity unreliable after ViewTransitions)
    const tabBar = document.querySelector('[data-tab-bar]') as HTMLElement;
    if (tabBar) {
      const stickyEl = document.querySelector('[data-sticky-header]') as HTMLElement || document.querySelector('.fixed.z-\\[90\\]') as HTMLElement;
      const stickyHeaderHeight = shouldShow && stickyEl ? stickyEl.offsetHeight : 0;
      tabBar.style.top = `calc(var(--weeb-nav-height, 60px) + ${stickyHeaderHeight-1}px)`;
    }
  }


  function renderField(label: string, value: string | string[] | null | undefined): { label: string; value: string | string[] } | null {
    if (!value) return null;
    return { label, value };
  }
</script>

{#if isLoading}
  <ShowContentSkeleton />
{:else if isError || !anime}
  <div class="show-error">
    <p>Failed to load anime details</p>
  </div>
{:else}
  <div class="show-root">
    <!-- Sticky Header (portalled to body) -->
    <div use:portal data-sticky-header class="fixed left-0 right-0 z-[90] transition-all duration-300 {showStickyHeader ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}" style="pointer-events: {showStickyHeader ? 'auto' : 'none'}; top: var(--weeb-nav-height, 60px);">
      <!-- Background container with overflow hidden -->
      <div class="relative overflow-hidden border-b border-weeb-border shadow-lg" style="padding: 8px 24px;">
        <!-- Background with blur -->
        <div
          class="absolute inset-0 bg-cover bg-center"
          style="background-image: {firstSource ? `url(${firstSource})` : 'none'}; filter: blur(12px) brightness(0.6); transform: scale(1.2);"
        ></div>
        <div class="absolute inset-0 backdrop-blur-md" style="background: oklch(14% 0.015 275 / 0.75);"></div>
        <div class="max-w-screen-2xl mx-auto relative z-10">
          <div class="flex items-center gap-3">
            <SafeImage
              src={GetImageFromAnime(anime)}
              alt={anime.titleEn || ""}
              className="w-9 h-14 object-cover rounded flex-shrink-0"
              fallbackSrc="/assets/not found.jpg"
            />
            <div class="min-w-0 flex-1">
              <h1 class="text-base font-semibold text-weeb-fg truncate">
                {animeTitle}
              </h1>
              <p class="text-xs text-weeb-fg-secondary truncate">
                {getYearUTC(anime.startDate)} • {anime.endDate ? "Finished" : "Ongoing"}
                {#if anime.studios && anime.studios.length > 0}
                  • {anime.studios[0]}
                {/if}
              </p>
            </div>
            <div class="flex-shrink-0">
              <AnimeActions
                {anime}
                variant="compact"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Hero Banner -->
    <section class="hero-banner" aria-label="Anime overview">
      <!-- Background image layer -->
      {#if imageSources.length > 0}
        <div
          class="hero-banner__bg"
          style="opacity: {bgLoaded ? 1 : 0};"
        >
          <SafeImage
            sources={imageSources}
            alt="Anime background"
            loading="eager"
            priority={true}
            fallbackSrc="/assets/not found.jpg"
            perTryTimeoutMs={3000}
            className="hero-banner__bg-img"
            style=""
            on:chosen={handleImageChosen}
          />
        </div>
      {/if}

      <div class="hero-inner">
        <!-- Poster -->
        <div class="hero-poster">
          <SafeImage
            src={GetImageFromAnime(anime)}
            alt={anime.titleEn || ""}
            className="hero-poster__img"
            fallbackSrc="/assets/not found.jpg"
          />
        </div>

        <!-- Meta -->
        <div class="hero-meta">
          <p class="hero-eyebrow">
            {anime.type || "TV"} Series &middot; {getYearUTC(anime.startDate)}
            {#if anime.studios && anime.studios.length > 0}
              &middot; {Array.isArray(anime.studios) ? anime.studios[0] : anime.studios}
            {/if}
          </p>

          <h1 class="hero-title">{animeTitle}</h1>
          {#if anime.titleJp}
            <p class="hero-title-jp">{anime.titleJp}</p>
          {/if}

          <!-- Ranking -->
          {#if anime.ranking}
            <div class="hero-score-row">
              <span class="hero-score-big" aria-label="Ranked #{anime.ranking}">#{anime.ranking}</span>
              <div class="hero-score-details">
                <div class="hero-score-stars" aria-hidden="true">
                  <svg class="rank-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M8 1l2.35 4.76 5.25.77-3.8 3.7.9 5.24L8 12.93l-4.7 2.54.9-5.24-3.8-3.7 5.25-.77z"/>
                  </svg>
                </div>
                <span class="hero-score-label">overall ranking</span>
              </div>
            </div>
          {/if}

          <!-- Genre tags -->
          {#if anime.tags && anime.tags.length > 0}
            <div class="hero-tags" role="list" aria-label="Genres">
              {#each anime.tags as tag}
                <span class="hero-tag" role="listitem">{tag}</span>
              {/each}
            </div>
          {/if}

          <!-- Details grid -->
          <dl class="hero-details">
            {#if anime.endDate}
              <dt class="hero-detail-key">Status</dt>
              <dd class="hero-detail-val">Finished</dd>
            {:else}
              <dt class="hero-detail-key">Status</dt>
              <dd class="hero-detail-val hero-detail-val--green">{anime.endDate ? "Finished" : "Airing"}</dd>
            {/if}

            {#if anime.episodes && anime.episodes.length > 0}
              <dt class="hero-detail-key">Episodes</dt>
              <dd class="hero-detail-val">{anime.episodes.length}</dd>
            {/if}

            {#if anime.duration}
              <dt class="hero-detail-key">Duration</dt>
              <dd class="hero-detail-val">{anime.duration}</dd>
            {/if}

            {#if anime.studios}
              <dt class="hero-detail-key">Studio</dt>
              <dd class="hero-detail-val">{Array.isArray(anime.studios) ? anime.studios.join(', ') : anime.studios}</dd>
            {/if}

            {#if anime.source}
              <dt class="hero-detail-key">Source</dt>
              <dd class="hero-detail-val">{anime.source}</dd>
            {/if}

            <dt class="hero-detail-key">Aired</dt>
            <dd class="hero-detail-val">
              {formatDateUTC(anime.startDate, "Unknown")} &ndash; {formatDateUTC(anime.endDate, "Ongoing")}
            </dd>
          </dl>
        </div>
      </div>
    </section>

    <!-- Quick Info Bar — stats + tracking in one clean strip -->
    <div class="quick-info">
      <div class="quick-info__inner">
        <!-- Stats row — horizontal chips -->
        <div class="quick-info__stats">
          {#if anime.ranking}
            <span class="qi-chip qi-chip--accent">
              <svg class="qi-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 1l2.35 4.76 5.25.77-3.8 3.7.9 5.24L8 12.93l-4.7 2.54.9-5.24-3.8-3.7 5.25-.77z"/></svg>
              #{anime.ranking}
            </span>
          {/if}
          <span class="qi-chip {anime.endDate ? '' : 'qi-chip--green'}">
            <span class="qi-dot {anime.endDate ? '' : 'qi-dot--green'}"></span>
            {anime.endDate ? "Finished" : "Airing"}
          </span>
          {#if anime.episodes}
            <span class="qi-chip">{anime.episodes.length} ep</span>
          {/if}
          {#if anime.duration}
            <span class="qi-chip">{anime.duration}</span>
          {/if}
          {#if anime.studios}
            <span class="qi-chip">{Array.isArray(anime.studios) ? anime.studios[0] : anime.studios}</span>
          {/if}
          {#if anime.rating}
            <span class="qi-chip">{anime.rating}</span>
          {/if}

          <!-- Next episode chip -->
          {#if nextEpisode || animeNextEpisodeInfo || hasTimingData}
            <span class="qi-chip qi-chip--next">
              {#if hasTimingData && currentlyAiring}
                <span class="qi-dot qi-dot--green qi-dot--pulse"></span>
                NOW
              {:else if hasTimingData && !currentlyAiring && !alreadyAired}
                {#if countdown && !countdown.includes("JUST AIRED") && !countdown.includes("AIRING NOW")}
                  Next in {countdown}
                {:else if countdown === "JUST AIRED"}
                  Just aired
                {:else}
                  Next soon
                {/if}
              {:else if episode}
                Next: Ep {episode.episodeNumber}
              {:else if animeNextEpisodeInfo}
                Next: Ep {animeNextEpisodeInfo?.episode.episodeNumber || "TBA"}
              {/if}
            </span>
          {/if}
        </div>

        <!-- Tracking controls — right side -->
        <div class="quick-info__tracking">
          <AnimeActions {anime} variant="default" />

          <div class="qi-score">
            <select class="qi-select" aria-label="Your score"
              value={anime.userAnime?.score || ''}
              disabled={!anime.userAnime}
            >
              <option value="">Score</option>
              {#each [10,9,8,7,6,5,4,3,2,1] as s}
                <option value={s}>{s}</option>
              {/each}
            </select>
          </div>

          <div class="qi-progress">
            <button class="qi-ep-btn" aria-label="Decrease episodes"
              disabled={!anime.userAnime || (anime.userAnime.episodesWatched || 0) <= 0}
            >−</button>
            <span class="qi-ep-count">
              {anime.userAnime?.episodesWatched || 0}/{anime.episodeCount || anime.episodes?.length || '?'}
            </span>
            <button class="qi-ep-btn" aria-label="Increase episodes"
              disabled={!anime.userAnime}
            >+</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Sticky Header is now in the Astro page ([id].astro) — outside Svelte to survive ViewTransitions -->

    <!-- Floating Tab Bar — ALL styles inline to survive ViewTransition CSS loss -->
    <nav data-tab-bar bind:this={tabBarEl} aria-label="Section navigation"
      style="position:sticky; top:var(--weeb-nav-height,60px); z-index:50; background:oklch(14% 0.015 275 / 0.95); border-bottom:1px solid oklch(28% 0.015 275); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); transition:top 0.3s ease;"
    >
      <div style="max-width:1280px; margin:0 auto; padding:0 48px; display:flex; align-items:center; gap:0;">
        <button
          style="padding:10px 20px; font-size:13px; font-weight:500; background:none; border:none; cursor:pointer; white-space:nowrap; border-bottom:2px solid {activeTab === 'synopsis' ? 'oklch(55% 0.15 280)' : 'transparent'}; color:{activeTab === 'synopsis' ? 'oklch(95% 0.005 265)' : 'oklch(55% 0.01 270)'};"
          on:click={() => scrollToSection('synopsis')}
        >Synopsis</button>
        {#if anime.episodes && anime.episodes.length > 0}
          <button
            style="padding:10px 20px; font-size:13px; font-weight:500; background:none; border:none; cursor:pointer; white-space:nowrap; display:flex; align-items:center; gap:6px; border-bottom:2px solid {activeTab === 'episodes' ? 'oklch(55% 0.15 280)' : 'transparent'}; color:{activeTab === 'episodes' ? 'oklch(95% 0.005 265)' : 'oklch(55% 0.01 270)'};"
            on:click={() => scrollToSection('episodes')}
          >Episodes <span style="font-size:11px; padding:2px 7px; border-radius:10px; background:oklch(55% 0.15 280 / 0.15); color:oklch(55% 0.15 280); font-weight:600;">{anime.episodes.length}</span></button>
        {/if}
        <button
          style="padding:10px 20px; font-size:13px; font-weight:500; background:none; border:none; cursor:pointer; white-space:nowrap; border-bottom:2px solid {activeTab === 'characters' ? 'oklch(55% 0.15 280)' : 'transparent'}; color:{activeTab === 'characters' ? 'oklch(95% 0.005 265)' : 'oklch(55% 0.01 270)'};"
          on:click={() => scrollToSection('characters')}
        >Characters</button>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="main-content">
      <div class="content-single">
        <!-- Synopsis -->
        <section class="content-section" bind:this={synopsisEl} aria-labelledby="synopsis-heading">
          <h2 class="section-heading" id="synopsis-heading">Synopsis</h2>
          {#if anime.description}
            <div class="synopsis-text">
              <p>{anime.description}</p>
            </div>
          {:else}
            <p class="synopsis-empty">No synopsis available.</p>
          {/if}
        </section>

        <!-- Episodes Section -->
        {#if anime.episodes && anime.episodes.length > 0}
          <section class="content-section" bind:this={episodesEl} aria-labelledby="episodes-heading">
            <h2 class="section-heading" id="episodes-heading">Episodes</h2>
            <Episodes episodes={anime.episodes} broadcast={anime.broadcast} />
          </section>
        {/if}

        <!-- Characters Section -->
        <section class="content-section" bind:this={charactersEl} aria-labelledby="characters-heading">
          <h2 class="section-heading" id="characters-heading">Characters & Staff</h2>
          <CharactersWithStaff animeId={anime.id} ssrCharactersData={charactersData} />
        </section>

        <!-- Additional Info -->
        <section class="content-section" aria-labelledby="info-heading">
          <h2 class="section-heading" id="info-heading">Information</h2>
          <div class="info-grid">
            {#if anime.titleJp}
              <div class="info-item">
                <span class="info-label">Japanese</span>
                <span class="info-value">{anime.titleJp}</span>
              </div>
            {/if}
            {#if anime.titleRomaji}
              <div class="info-item">
                <span class="info-label">Romaji</span>
                <span class="info-value">{anime.titleRomaji}</span>
              </div>
            {/if}
            {#if anime.studios}
              <div class="info-item">
                <span class="info-label">Studios</span>
                <span class="info-value">{Array.isArray(anime.studios) ? anime.studios.join(', ') : anime.studios}</span>
              </div>
            {/if}
            {#if anime.source}
              <div class="info-item">
                <span class="info-label">Source</span>
                <span class="info-value">{anime.source}</span>
              </div>
            {/if}
            {#if anime.licensors && anime.licensors.length > 0}
              <div class="info-item">
                <span class="info-label">Licensors</span>
                <span class="info-value">{Array.isArray(anime.licensors) ? anime.licensors.join(', ') : anime.licensors}</span>
              </div>
            {/if}
            {#if anime.rating}
              <div class="info-item">
                <span class="info-label">Rating</span>
                <span class="info-value">{anime.rating}</span>
              </div>
            {/if}
            {#if anime.broadcast}
              <div class="info-item">
                <span class="info-label">Broadcast</span>
                <span class="info-value">{anime.broadcast}</span>
              </div>
            {/if}
            <div class="info-item">
              <span class="info-label">Aired</span>
              <span class="info-value">{formatDateUTC(anime.startDate, "Unknown")} &ndash; {formatDateUTC(anime.endDate, "Ongoing")}</span>
            </div>
            {#if anime.titleSynonyms && anime.titleSynonyms.length > 0}
              <div class="info-item info-item--full">
                <span class="info-label">Synonyms</span>
                <span class="info-value">{anime.titleSynonyms.join(", ")}</span>
              </div>
            {/if}
          </div>
        </section>
      </div>

      <!-- Footer -->
      <footer class="show-footer">
        <p>
          Last updated: {anime.updatedAt ? format(new Date(anime.updatedAt), "dd MMM yyyy") : "Unknown"}
        </p>
      </footer>
    </main>
  </div>
{/if}

<style>
  /* ===========================
     ROOT & ERROR
  =========================== */
  .show-root {
    min-height: 100vh;
    background: var(--weeb-bg);
    position: relative;
  }

  .show-error {
    min-height: 100vh;
    background: var(--weeb-surface);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .show-error p {
    color: var(--weeb-fg-muted);
  }

  /* ===========================
     HERO BANNER
  =========================== */
  .hero-banner {
    position: relative;
    overflow: hidden;
    border-bottom: 1px solid var(--weeb-border);
    background: linear-gradient(
      180deg,
      color-mix(in oklch, var(--weeb-bg-elevated), var(--weeb-accent) 12%) 0%,
      color-mix(in oklch, var(--weeb-bg), var(--weeb-accent) 4%) 60%,
      var(--weeb-bg) 100%
    );
  }

  .hero-banner::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 80% 60% at 30% 20%, color-mix(in oklch, var(--weeb-accent), transparent 75%), transparent),
      radial-gradient(ellipse 60% 50% at 70% 60%, color-mix(in oklch, var(--weeb-violet), transparent 85%), transparent);
    pointer-events: none;
  }

  .hero-banner__bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    transition: opacity 0.3s ease;
  }

  :global(.hero-banner__bg-img) {
    position: absolute;
    width: 100%;
    height: 100%;
    object-fit: cover;
    mask-image: linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.1) 60%, transparent 100%);
    -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.1) 60%, transparent 100%);
  }

  .hero-inner {
    max-width: 1440px;
    margin: 0 auto;
    padding: 48px 40px 40px;
    display: grid;
    grid-template-columns: 240px 1fr;
    gap: 48px;
    align-items: start;
    position: relative;
    z-index: 1;
  }

  .hero-poster {
    width: 240px;
    height: 340px;
    flex-shrink: 0;
    border-radius: var(--weeb-radius-lg);
    position: relative;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  :global(.hero-poster__img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .hero-meta {
    padding-top: 4px;
  }

  .hero-eyebrow {
    font-family: var(--weeb-font-mono);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.1em;
    color: var(--weeb-fg-muted);
    text-transform: uppercase;
    margin-bottom: 10px;
  }

  .hero-title {
    font-family: var(--weeb-font);
    font-size: clamp(28px, 4vw, 42px);
    font-weight: 800;
    line-height: 1.15;
    letter-spacing: -0.025em;
    color: var(--weeb-fg);
    margin-bottom: 6px;
  }

  .hero-title-jp {
    font-size: 15px;
    color: var(--weeb-fg-muted);
    margin-bottom: 24px;
    font-weight: 400;
  }

  .hero-score-row {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 24px;
  }

  .hero-score-big {
    font-family: var(--weeb-font-mono);
    font-size: 48px;
    font-weight: 800;
    color: var(--weeb-accent);
    line-height: 1;
    letter-spacing: -0.03em;
  }

  .hero-score-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .hero-score-label {
    font-size: 12px;
    color: var(--weeb-fg-muted);
  }

  .hero-score-stars {
    display: flex;
    gap: 2px;
  }

  .rank-icon {
    width: 18px;
    height: 18px;
    color: var(--weeb-amber);
  }

  .hero-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 24px;
  }

  .hero-tag {
    font-size: 12px;
    font-weight: 500;
    padding: 5px 12px;
    border: 1px solid var(--weeb-border);
    border-radius: 20px;
    color: var(--weeb-fg-secondary);
    background: color-mix(in oklch, var(--weeb-bg-elevated), transparent 40%);
    transition: border-color 0.15s, color 0.15s, background 0.15s;
    cursor: pointer;
  }

  .hero-tag:hover {
    border-color: var(--weeb-accent);
    color: var(--weeb-accent);
    background: color-mix(in oklch, var(--weeb-accent), transparent 85%);
  }

  .hero-details {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 8px 32px;
  }

  .hero-detail-key {
    font-family: var(--weeb-font-mono);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: var(--weeb-fg-muted);
    text-transform: uppercase;
    white-space: nowrap;
  }

  .hero-detail-val {
    font-size: 13px;
    color: var(--weeb-fg-secondary);
  }

  .hero-detail-val--green {
    color: var(--weeb-green);
    font-weight: 600;
  }

  /* ===========================
     QUICK INFO BAR
  =========================== */
  .quick-info {
    max-width: 1440px;
    margin: 0 auto;
    padding: 0 var(--weeb-section-px, 48px);
    position: relative;
    z-index: 2;
    margin-top: -16px;
  }

  .quick-info__inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 20px;
    background: var(--weeb-bg-elevated);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius-lg);
    overflow: visible;
    position: relative;
    z-index: 10;
  }

  /* Stats — left side: horizontal scrollable chips */
  .quick-info__stats {
    display: flex;
    align-items: center;
    gap: 8px;
    overflow-x: auto;
    -ms-overflow-style: none;
    scrollbar-width: none;
    flex: 1;
    min-width: 0;
  }
  .quick-info__stats::-webkit-scrollbar { display: none; }

  .qi-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 12px;
    font-size: 12px;
    font-weight: 600;
    color: var(--weeb-fg-secondary);
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius-full, 9999px);
    white-space: nowrap;
    flex-shrink: 0;
    line-height: 1;
  }

  .qi-chip--accent {
    color: var(--weeb-accent);
    border-color: color-mix(in oklch, var(--weeb-accent), transparent 70%);
    background: color-mix(in oklch, var(--weeb-accent), transparent 90%);
  }

  .qi-chip--green {
    color: var(--weeb-green);
    border-color: color-mix(in oklch, var(--weeb-green), transparent 70%);
  }

  .qi-chip--next {
    color: var(--weeb-amber);
    border-color: color-mix(in oklch, var(--weeb-amber), transparent 70%);
    background: color-mix(in oklch, var(--weeb-amber), transparent 90%);
    font-family: var(--weeb-font-mono);
    font-weight: 700;
  }

  .qi-icon {
    width: 12px;
    height: 12px;
    flex-shrink: 0;
  }

  .qi-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--weeb-fg-muted);
    flex-shrink: 0;
  }
  .qi-dot--green {
    background: var(--weeb-green);
  }
  .qi-dot--pulse {
    animation: dotPulse 1.5s ease-in-out infinite;
  }
  @keyframes dotPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  /* Tracking — right side */
  .quick-info__tracking {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .qi-select {
    height: 32px;
    padding: 0 8px;
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius);
    background: var(--weeb-surface);
    color: var(--weeb-fg);
    font-family: var(--weeb-font-mono);
    font-size: 12px;
    font-weight: 600;
    outline: none;
    cursor: pointer;
    min-width: 60px;
    appearance: auto;
  }
  .qi-select:focus { border-color: var(--weeb-accent); }
  .qi-select:disabled { opacity: 0.3; cursor: not-allowed; }

  .qi-progress {
    display: flex;
    align-items: center;
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius);
    overflow: hidden;
    height: 32px;
  }

  .qi-ep-btn {
    width: 28px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--weeb-surface);
    border: none;
    color: var(--weeb-fg-muted);
    font-size: 14px;
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
  }
  .qi-ep-btn:hover { background: var(--weeb-surface-hover); color: var(--weeb-fg); }
  .qi-ep-btn:disabled { opacity: 0.3; cursor: not-allowed; }

  .qi-ep-count {
    padding: 0 8px;
    font-family: var(--weeb-font-mono);
    font-size: 12px;
    font-weight: 600;
    color: var(--weeb-fg);
    border-left: 1px solid var(--weeb-border);
    border-right: 1px solid var(--weeb-border);
    background: var(--weeb-surface);
    height: 32px;
    display: flex;
    align-items: center;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  /* ===========================
     STICKY HEADER — now in [id].astro (outside Svelte)
  =========================== */

  /* ===========================
     FLOATING TAB BAR
  =========================== */
  .tab-bar {
    position: sticky;
    top: var(--weeb-nav-height, 60px);
    z-index: 80;
    background: oklch(14% 0.015 275 / 0.95);
    border-bottom: 1px solid var(--weeb-border);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    transition: top 0.3s ease;
  }

  .tab-bar__inner {
    max-width: 1440px;
    margin: 0 auto;
    padding: 0 var(--weeb-section-px, 48px);
    display: flex;
    gap: 0;
  }

  .tab-bar__tab {
    background: none;
    border: none;
    color: var(--weeb-fg-muted);
    font-family: var(--weeb-font);
    font-size: 13px;
    font-weight: 500;
    padding: 14px 20px;
    cursor: pointer;
    position: relative;
    transition: color 0.15s;
    display: flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
  }

  .tab-bar__tab:hover {
    color: var(--weeb-fg-secondary);
  }

  .tab-bar__tab--active {
    color: var(--weeb-fg);
  }

  .tab-bar__tab--active::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 20px;
    right: 20px;
    height: 2px;
    background: var(--weeb-accent);
    border-radius: 1px;
  }

  .tab-bar__count {
    font-size: 11px;
    font-family: var(--weeb-font-mono);
    background: var(--weeb-surface);
    color: var(--weeb-fg-secondary);
    padding: 1px 6px;
    border-radius: var(--weeb-radius-full, 9999px);
    border: 1px solid var(--weeb-border);
  }

  @media (max-width: 768px) {
    .tab-bar {
      /* Always visible on mobile */
    }
    .tab-bar__inner {
      padding: 0 16px;
      justify-content: stretch;
    }
    .tab-bar__tab {
      padding: 12px 8px;
      font-size: 12px;
      flex: 1;
      justify-content: center;
    }
  }

  /* ===========================
     NEXT EPISODE BANNER
  =========================== */
  /* next-ep-banner and tracking-bar styles removed — now using quick-info */

  /* ===========================
     MAIN CONTENT
  =========================== */
  .main-content {
    max-width: 1440px;
    margin: 0 auto;
    width: 100%;
    padding: 0 var(--weeb-section-px, 48px);
  }

  .content-single {
    display: flex;
    flex-direction: column;
    gap: 40px;
    padding: 40px 0 20px;
  }

  .content-section {
    /* Each section is a clean block */
  }

  /* ===========================
     SECTION HEADINGS
  =========================== */
  .section-heading {
    font-family: var(--weeb-font);
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: var(--weeb-fg);
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .section-heading::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--weeb-border);
  }

  /* ===========================
     SYNOPSIS
  =========================== */
  .synopsis-text {
    font-size: 15px;
    line-height: 1.8;
    color: var(--weeb-fg-secondary);
    max-width: 80ch;
  }

  .synopsis-empty {
    font-size: 14px;
    color: var(--weeb-fg-muted);
    font-style: italic;
  }

  /* ===========================
     TRACKING CARD
  =========================== */
  /* ===========================
     INFO GRID
  =========================== */
  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 0;
    background: var(--weeb-bg-elevated);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius-lg);
    overflow: hidden;
  }

  .info-item {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 16px;
    padding: 14px 20px;
    border-bottom: 1px solid var(--weeb-border);
    border-right: 1px solid var(--weeb-border);
  }

  .info-item--full {
    grid-column: 1 / -1;
    border-right: none;
  }

  .info-label {
    font-family: var(--weeb-font-mono);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: var(--weeb-fg-muted);
    text-transform: uppercase;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .info-value {
    font-size: 13px;
    color: var(--weeb-fg-secondary);
    text-align: right;
    line-height: 1.4;
  }

  /* ===========================
     FOOTER
  =========================== */
  .show-footer {
    border-top: 1px solid var(--weeb-border);
    padding: 32px 0;
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
  }

  .show-footer p {
    font-size: 12px;
    color: var(--weeb-fg-muted);
  }

  /* ===========================
     RESPONSIVE -- 1024px
  =========================== */
  @media (max-width: 1024px) {
    .info-grid {
      grid-template-columns: 1fr;
    }

    .info-item {
      border-right: none;
    }

  }

  /* ===========================
     RESPONSIVE -- 768px
  =========================== */
  @media (max-width: 768px) {
    .hero-inner {
      grid-template-columns: 1fr;
      gap: 24px;
      padding: 32px 20px;
    }

    .hero-poster {
      width: 180px;
      height: 256px;
      margin: 0 auto;
    }

    .hero-meta {
      text-align: center;
    }

    .hero-tags {
      justify-content: center;
    }

    .hero-details {
      justify-content: center;
      max-width: 400px;
      margin: 0 auto;
    }

    .hero-score-row {
      justify-content: center;
    }

    .main-content {
      padding: 0 16px;
    }

    .quick-info {
      padding: 0 16px;
    }
    .quick-info__inner {
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
      padding: 12px 14px;
    }
    .quick-info__tracking {
      flex-wrap: wrap;
      gap: 6px;
    }

    .content-single {
      gap: 32px;
      padding: 28px 0 16px;
    }
  }

  /* ===========================
     RESPONSIVE -- 480px
  =========================== */
  @media (max-width: 480px) {
    .hero-title {
      font-size: 24px;
    }

    .hero-score-big {
      font-size: 36px;
    }

    .hero-poster {
      width: 160px;
      height: 228px;
    }

    .quick-info {
      margin-top: -8px;
    }
  }
</style>
