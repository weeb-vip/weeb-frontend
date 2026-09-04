<script lang="ts">
  import { onMount } from 'svelte';
  import { format } from 'date-fns';
  import { createQuery, createMutation } from '@tanstack/svelte-query';
  import { derived, writable } from 'svelte/store';
  import { watchedEpisodes, markEpisodeWatched, unmarkEpisodeWatched } from '../../services/queries';
  import { getQueryClient } from '../services/query-client';
  import SafeImage from './SafeImage.svelte';
  import AnimeActions from './AnimeActions.svelte';
  import Tag from './Tag.svelte';
  import Episodes from './Episodes.svelte';
  import CharactersWithStaff from './CharactersWithStaff.svelte';
  import RelatedAnime from './RelatedAnime.svelte';
  import AnimeNews from './AnimeNews.svelte';
  import { isFeatureEnabled } from '../../utils/analytics';
  import StreamingPlatforms from './StreamingPlatforms.svelte';
  import { fetchDetails } from '../../services/queries';
  import { GetImageFromAnime, getYearUTC, formatDateUTC, animeHref } from '../../services/utils';
  import { getSafeImageUrl } from '../utils/image';
  import { findNextEpisode, getCurrentTime, getAirTimeDisplay, parseDurationToMinutes, parseAirTime, getAirDateTime } from '../../services/airTimeUtils';
  import debug from '../../utils/debug';
  import { animeNotificationStore } from '../stores/animeNotifications';
  import ShowContentSkeleton from './ShowContentSkeleton.svelte';
  import { preferencesStore, getAnimeTitle } from '../stores/preferences';
  import { useAddAnimeWithToast } from '../utils/anime-actions';

  // Subscribe to preferences for reactive title updates
  $: preferences = $preferencesStore;
  $: animeTitle = anime ? getAnimeTitle(anime, preferences.titleLanguage) : '';

  // "Season 2", or "Special" for TheTVDB's season 0.
  //
  // Null and 0 are different answers and must not collapse: null is "we do not
  // know", which shows nothing, while 0 is the specials season and shows as
  // "Special". A truthiness check would render neither, which is why this
  // tests for null explicitly.
  $: seasonLabel = (() => {
    const n = anime?.seasonNumber;
    if (n === null || n === undefined) return '';

    return n === 0 ? 'Special' : `Season ${n}`;
  })();
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

  // Tracking controls: score + episode progress both go through the same
  // upsert mutation used elsewhere (invalidates queries, toasts errors)
  const upsertAnime = useAddAnimeWithToast();

  // Per-episode progress, which the count on userAnime cannot express: it can
  // only say "up to N", so watching 1, 2 and 5 claimed 3 and 4 as well.
  //
  // Created once, like showQueryStore above. Building it inside a reactive
  // statement makes a fresh query store on every invalidation, so `$query.data`
  // is read from a store that has not resolved yet and is permanently
  // undefined -- the episode list then fell back to the count and drew every
  // episode unwatched, while the rows existed in the database.
  //
  // Reactivity comes from a store of options instead, which is what
  // svelte-query wants: `enabled` has to follow userAnime appearing, since a
  // signed-out viewer has nothing to fetch and the field is authenticated.
  const episodeQueryClient = getQueryClient();
  const episodeTracking = writable({ animeId: '', enabled: false });
  $: episodeTracking.set({
    animeId: anime?.id ?? '',
    enabled: Boolean(anime?.id) && Boolean(anime?.userAnime),
  });

  const watchedQuery = createQuery(
    derived(episodeTracking, ($t) => ({
      ...watchedEpisodes($t.animeId),
      enabled: $t.enabled,
    })),
    episodeQueryClient,
  );

  // Null until the query has answered, so Episodes falls back to the count
  // rather than rendering everything unwatched for a moment -- which would
  // invite a click that un-marks something.
  $: watchedNumbers = $watchedQuery?.data
    ? new Set<number>($watchedQuery.data.map((e: any) => e.episodeNumber))
    : null;

  const markEpisode = createMutation({
    mutationFn: async (vars: { episodeNumber: number; watched: boolean }) => {
      const input = { input: { animeID: anime.id, episodeNumber: vars.episodeNumber } };
      return vars.watched
        ? markEpisodeWatched().mutationFn(input)
        : unmarkEpisodeWatched().mutationFn(input);
    },
    // Both the episode list and the aggregate count move: list-service derives
    // userAnime.episodes from these rows, so the show's own query is stale too.
    onSuccess: () => episodeQueryClient.invalidateQueries(),
  }, episodeQueryClient);

  function trackingInput(overrides: { score?: number; episodes?: number }) {
    return {
      input: {
        animeID: anime.id,
        status: anime.userAnime?.status ?? undefined,
        score: anime.userAnime?.score ?? undefined,
        episodes: anime.userAnime?.episodes ?? 0,
        ...overrides
      }
    };
  }

  function handleScoreChange(event: Event) {
    const value = (event.currentTarget as HTMLSelectElement).value;
    if (!anime?.userAnime || value === '') return;
    $upsertAnime.mutate(trackingInput({ score: Number(value) }));
  }

  function adjustEpisodes(delta: number) {
    if (!anime?.userAnime) return;
    const current = anime.userAnime.episodes ?? 0;
    const max = anime.episodeCount || anime.episodes?.length || Infinity;
    const next = Math.min(Math.max(current + delta, 0), max);
    if (next === current) return;
    $upsertAnime.mutate(trackingInput({ episodes: next }));
  }

  // DOM refs
  let tabBarEl: HTMLElement;

  // Floating tab bar state
  let activeTab = 'synopsis';
  let showTabBar = false;
  // News is behind a flag while the research pipeline's quality gate is still being
  // sorted out. Client-driven like the animeschedule gate: the flag is unavailable
  // during SSR, and PostHog's onFeatureFlags can fire once while the flag still reads
  // false and never re-fire, so re-check briefly until it resolves.
  let newsEnabled = false;
  onMount(() => {
    let tries = 0;
    const check = () => { newsEnabled = isFeatureEnabled('anime-news'); return newsEnabled; };
    if (check()) return;
    const iv = setInterval(() => { if (check() || ++tries >= 25) clearInterval(iv); }, 250);
    return () => clearInterval(iv);
  });

  let synopsisEl: HTMLElement;
  let newsEl: HTMLElement;
  let episodesEl: HTMLElement;
  let charactersEl: HTMLElement;

  function scrollToSection(id: string) {
    const el = id === 'synopsis' ? synopsisEl
      : id === 'news' ? newsEl
      : id === 'episodes' ? episodesEl
      : charactersEl;
    if (el) {
      const rootStyle = getComputedStyle(document.documentElement);
      const navHeight = parseInt(rootStyle.getPropertyValue('--weeb-nav-height') || '60');
      const stackHeight = parseInt(rootStyle.getPropertyValue('--weeb-sticky-offset') || '0');
      const top = el.getBoundingClientRect().top + window.scrollY - navHeight - stackHeight - 8;
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
    // Checked bottom-up so the lowest section that has crossed the line wins.
    if (charactersEl && charactersEl.getBoundingClientRect().top < offset + 100) {
      activeTab = 'characters';
    } else if (episodesEl && episodesEl.getBoundingClientRect().top < offset + 100) {
      activeTab = 'episodes';
    } else if (newsEl && newsEl.getBoundingClientRect().top < offset + 100) {
      activeTab = 'news';
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

  // Create query at top level (required for Svelte lifecycle).
  // Skip the client fetch when SSR already provided the details — otherwise
  // this refetches the heaviest document in the app on every show view.
  showQueryStore = createQuery({
    ...fetchDetails(animeId),
    enabled: !ssrAnimeData
  });

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
    // The offset lives on documentElement, which outlives this component. Left
    // set, every other route would scroll as though it had this page's sticky
    // stack under its nav.
    document.documentElement.style.removeProperty('--weeb-sticky-offset');
  }

  onMount(() => {
    // Check WebP support (async, but don't block cleanup return)
    checkWebPSupport().then(result => {
      supportsWebP = result;
    });

    // Attach scroll listeners
    attachScrollListeners();

    // Cleanup
    return () => {
      detachScrollListeners();
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

    // Both are keyed by anime id: banners/<id> for the tvdb artwork synced by
    // thetvdb-enrichment, <id> at the root for the poster. Built through
    // getSafeImageUrl so they follow config.cdn_url. Hardcoding the host meant
    // local and staging read production artwork, which hid the fact that staging
    // had no banners of its own.
    if (anime.id) {
      // Priority 1: CDN banner
      sources.push(getSafeImageUrl(anime.id, 'banners'));
      // Priority 2: CDN poster as fallback
      sources.push(getSafeImageUrl(anime.id));
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
    scheduled: { color: 'text-weeb-accent-text', text: 'Next Episode', icon: 'fa-calendar' }
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

      // Publish the measured stack so scroll-padding-top and scrollToSection stop
      // guessing. Three places used to carry their own idea of this height -- CSS
      // said 0, scrollToSection said 72 + 48, and only this function measured it,
      // which is why a focused element or an anchor landed underneath the bars.
      // offsetHeight is 0 while a bar is hidden, so the value follows visibility
      // for free.
      const stackHeight = stickyHeaderHeight + tabBar.offsetHeight;
      document.documentElement.style.setProperty('--weeb-sticky-offset', `${stackHeight}px`);
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
      <div class="relative overflow-hidden border-b border-weeb-border shadow-lg sticky-header-inner">
        <!-- Background with blur -->
        <div
          class="absolute inset-0 bg-cover bg-center"
          style="background-image: {firstSource ? `url(${firstSource})` : 'none'}; filter: blur(12px) brightness(0.6); transform: scale(1.2);"
        ></div>
        <div class="absolute inset-0 backdrop-blur-md" style="background: oklch(14% 0.015 275 / 0.75);"></div>
        <div class="relative z-10">
          <div class="flex items-center gap-3">
            <SafeImage
              src={GetImageFromAnime(anime)}
              alt={anime.titleEn || ""}
              className="w-9 h-14 object-cover rounded flex-shrink-0"
              fallbackSrc="/assets/not found.jpg"
            />
            <div class="min-w-0 flex-1">
              <!-- Not an h1: this is the sticky compact header, which repeats the title
                   as navigation chrome. The page's h1 is the hero title further down,
                   and having both made every show page emit two identical h1s. -->
              <p class="text-base font-semibold text-weeb-fg truncate">
                {animeTitle}
              </p>
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

      <!-- Same two-edge treatment as the homepage banner: a scrim only under
           the nav, and a fade band below the fold. -->
      <div class="hero-scrim-top"></div>
      <div class="hero-scrim-bottom"></div>

      <div class="hero-stage">
        <!-- Identity -->
        <div class="hero-panel">
          <!-- The poster, which the page did not show anywhere.
               The artwork behind the hero is the wide banner; the 2:3 cover was
               only ever visible in the sticky header once you scrolled. It sits
               beside the identity text rather than above it so it costs no
               vertical space on a phone, where the panels were already
               deliberately tightened to keep the banner visible. -->
          <!-- Two bands. The poster and the show's name pair up top, because
               together they are what identifies it. Everything else -- what kind
               of show it is, what it is about, and the one action -- belongs to
               the show rather than to its name, so it sits below on the panel's
               full width and centred. It was previously stacked inside a 221px
               column beside the poster, where the tag rows wrapped and the
               action sat indented against empty space. -->
          <div class="hero-identity">
            <div class="hero-poster">
              <SafeImage
                src={GetImageFromAnime(anime)}
                alt=""
                className="hero-poster-img"
                fallbackSrc="/assets/not found.jpg"
                cdnWidth={300}
              />
            </div>

            <div class="hero-identity-text">
              <h1 class="hero-title">{animeTitle}</h1>
              {#if anime.titleJp}
                <!-- lang="ja": Japanese text inside a lang="en" document. Tells search
                     engines which language it is, and screen readers which voice to use. -->
                <p class="hero-title-jp" lang="ja">{anime.titleJp}</p>
              {/if}
            </div>
          </div>

          <div class="hero-panel-body">
            <!-- Under the title, not above it. The name identifies the show;
                 format, year and studio qualify it. -->
            <p class="hero-meta">
              {anime.type || "TV"} Series &middot; {getYearUTC(anime.startDate)}
              {#if anime.studios && anime.studios.length > 0}
                &middot; {Array.isArray(anime.studios) ? anime.studios[0] : anime.studios}
              {/if}
              <!-- Which run of the series this is, when it is known. Sits with
                   the other qualifiers rather than beside the title: the name
                   already says which show, this says which part of it.

                   Absent for most of the catalogue. The season is derived from
                   the air dates TheTVDB and MyAnimeList agree on, and that
                   derivation refuses rather than guesses -- so an unknown
                   season renders as nothing at all, never as "Season ?". -->
              {#if seasonLabel}
                &middot; {seasonLabel}
              {/if}
            </p>

            <!-- What this adapts, when we know it. The link is the only way
                 into a work's page from inside the catalogue, and it is what
                 makes the two re-adaptations of one manga reachable from each
                 other. Absent for originals and for sources MyAnimeList's manga
                 database does not cover, which together are most of the
                 catalogue -- so it renders nothing rather than a placeholder. -->
            {#if anime.sourceWork?.urlSlug}
              <p class="hero-source">
                <span class="hero-source-label">Adapted from</span>
                <a class="hero-source-link" href="/manga/{anime.sourceWork.urlSlug}">
                  {anime.sourceWork.titleEn || anime.sourceWork.titleJp}
                </a>
              </p>
            {/if}

            <!-- Genre tags -->
            {#if anime.tags && anime.tags.length > 0}
              <div class="hero-tags" role="list" aria-label="Genres">
                {#each anime.tags as tag}
                  <span class="hero-tag" role="listitem">{tag}</span>
                {/each}
              </div>
            {/if}

            <!-- Where to watch -->
            <StreamingPlatforms platforms={anime.streamingPlatforms} centerOnMobile />

            <div class="hero-actions">
              <AnimeActions {anime} variant="hero" />
            </div>
          </div>
        </div>

        <!-- The schedule, and only the schedule.
             This carried the ranking and a details list as well, both of which
             the quick-info bar immediately below already shows -- ranking,
             status, episode count, duration and studio are all chips down
             there. A panel of glass over the artwork is expensive; it has to
             earn its place with something the page does not already say.

             Rendered only when there is something to schedule. Without this
             guard a finished show got a container built around a single line of
             duplicated text. -->
        {#if hasTimingData && countdown}
          <aside class="hero-aside" aria-label="Broadcast schedule">
            <div class="hero-next">
              <span class="hero-next-label">
                {currentlyAiring ? 'Airing now' : alreadyAired ? 'Recently aired' : 'Next episode'}
              </span>
              <span class="hero-next-countdown">{countdown}</span>
              {#if episode?.episodeNumber}
                <span class="hero-next-ep">EP {episode.episodeNumber}</span>
              {/if}
              {#if airTimeAndDate}
                <span class="hero-next-when">{format(airTimeAndDate, 'EEE d MMM, h:mm a')}</span>
              {/if}
            </div>
          </aside>
        {/if}
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
              disabled={!anime.userAnime || $upsertAnime.isPending}
              on:change={handleScoreChange}
            >
              <option value="">Score</option>
              {#each [10,9,8,7,6,5,4,3,2,1] as s}
                <option value={s}>{s}</option>
              {/each}
            </select>
          </div>

          <div class="qi-progress">
            <button class="qi-ep-btn" aria-label="Decrease episodes"
              disabled={!anime.userAnime || $upsertAnime.isPending || (anime.userAnime.episodes || 0) <= 0}
              on:click={() => adjustEpisodes(-1)}
            >−</button>
            <span class="qi-ep-count">
              {anime.userAnime?.episodes || 0}/{anime.episodeCount || anime.episodes?.length || '?'}
            </span>
            <button class="qi-ep-btn" aria-label="Increase episodes"
              disabled={!anime.userAnime || $upsertAnime.isPending}
              on:click={() => adjustEpisodes(1)}
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
      <div class="tab-bar-inner">
        <button
          style="padding:10px 20px; font-size:13px; font-weight:500; background:none; border:none; cursor:pointer; white-space:nowrap; border-bottom:2px solid {activeTab === 'synopsis' ? 'var(--weeb-accent)' : 'transparent'}; color:{activeTab === 'synopsis' ? 'var(--weeb-fg)' : 'var(--weeb-fg-muted)'};"
          on:click={() => scrollToSection('synopsis')}
        >Synopsis</button>
        {#if newsEnabled && anime.news && anime.news.length > 0}
          <button
            style="padding:10px 20px; font-size:13px; font-weight:500; background:none; border:none; cursor:pointer; white-space:nowrap; display:flex; align-items:center; gap:6px; border-bottom:2px solid {activeTab === 'news' ? 'var(--weeb-accent)' : 'transparent'}; color:{activeTab === 'news' ? 'var(--weeb-fg)' : 'var(--weeb-fg-muted)'};"
            on:click={() => scrollToSection('news')}
          >News <span style="font-size:11px; padding:2px 7px; border-radius:10px; background:color-mix(in oklch, var(--weeb-accent) 15%, transparent); color:var(--weeb-accent-text); font-weight:600;">{anime.news.length}</span></button>
        {/if}
        {#if anime.episodes && anime.episodes.length > 0}
          <button
            style="padding:10px 20px; font-size:13px; font-weight:500; background:none; border:none; cursor:pointer; white-space:nowrap; display:flex; align-items:center; gap:6px; border-bottom:2px solid {activeTab === 'episodes' ? 'var(--weeb-accent)' : 'transparent'}; color:{activeTab === 'episodes' ? 'var(--weeb-fg)' : 'var(--weeb-fg-muted)'};"
            on:click={() => scrollToSection('episodes')}
          >Episodes <span style="font-size:11px; padding:2px 7px; border-radius:10px; background:color-mix(in oklch, var(--weeb-accent) 15%, transparent); color:var(--weeb-accent-text); font-weight:600;">{anime.episodes.length}</span></button>
        {/if}
        <button
          style="padding:10px 20px; font-size:13px; font-weight:500; background:none; border:none; cursor:pointer; white-space:nowrap; border-bottom:2px solid {activeTab === 'characters' ? 'var(--weeb-accent)' : 'transparent'}; color:{activeTab === 'characters' ? 'var(--weeb-fg)' : 'var(--weeb-fg-muted)'};"
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

        <!-- News Section — sits directly under Synopsis because it is the only
             part of this page that changes after the first visit. Capped at the
             latest 5; the rest live at /anime/[slug]/news. -->
        {#if newsEnabled && anime.news && anime.news.length > 0}
          <section class="content-section" bind:this={newsEl} aria-labelledby="news-heading">
            <h2 class="section-heading" id="news-heading">News</h2>
            <AnimeNews news={anime.news} limit={5} viewAllHref={animeHref(anime, '/news')} />
          </section>
        {/if}

        <!-- Episodes Section -->
        {#if anime.episodes && anime.episodes.length > 0}
          <section class="content-section" bind:this={episodesEl} aria-labelledby="episodes-heading">
            <h2 class="section-heading" id="episodes-heading">Episodes</h2>
            <Episodes
              episodes={anime.episodes}
              watchedCount={anime.userAnime?.episodes ?? 0}
              {watchedNumbers}
              canTrack={Boolean(anime.userAnime)}
              pending={$upsertAnime.isPending || $markEpisode.isPending}
              on:watch={(e) => $markEpisode.mutate(e.detail)}
            />
          </section>
        {/if}

        <!-- Characters Section -->
        <section class="content-section" bind:this={charactersEl} aria-labelledby="characters-heading">
          <h2 class="section-heading" id="characters-heading">Characters & Staff</h2>
          <CharactersWithStaff animeId={anime.id} ssrCharactersData={charactersData} />
        </section>

        <!-- Other entries in the same series. Placed after the cast and before
             the raw information block: it is a way onward through the franchise,
             which belongs with the other browsing surfaces rather than with the
             reference data. Renders nothing at all when the anime has no
             TheTVDB series id, which is most of the catalogue -- an empty
             "Related" heading would assert this show stands alone, and the
             absence of a series id does not mean that. -->
        {#if anime.relatedAnime && anime.relatedAnime.length > 0}
          <section class="content-section" aria-labelledby="related-heading">
            <h2 class="section-heading" id="related-heading">Related anime</h2>
            <RelatedAnime related={anime.relatedAnime} current={anime} />
          </section>
        {/if}

        <!-- Additional Info -->
        <section class="content-section" aria-labelledby="info-heading">
          <h2 class="section-heading" id="info-heading">Information</h2>
          <div class="info-grid">
            {#if anime.titleJp}
              <div class="info-item">
                <span class="info-label">Japanese</span>
                <span class="info-value" lang="ja">{anime.titleJp}</span>
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
                <!-- The value stays the category MyAnimeList records -- "Light novel",
                     "Manga" -- and becomes a link to the actual work once we know which
                     one. Which is the point of modelling works at all: the category told
                     you what kind of thing it came from, never which one. -->
                {#if anime.sourceWork?.urlSlug}
                  <a
                    class="info-value info-value--link"
                    href="/manga/{anime.sourceWork.urlSlug}"
                    title={anime.sourceWork.titleEn || anime.sourceWork.titleJp || undefined}
                  >{anime.source}</a>
                {:else}
                  <span class="info-value">{anime.source}</span>
                {/if}
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
  /* Same stage as the homepage banner: full-screen key art, a scrim only under
     the nav, a fade band below the fold, and content in panels on panel glass.
     The old accent-tinted gradient ground is gone -- the artwork is the ground. */
  .hero-banner {
    /* Extra banner below the fold carrying the dissolve into the page ground, so
       the artwork does not end on a hard cut. Nothing of it shows at rest. */
    --hero-fade: 100px;
    position: relative;
    min-height: calc(100svh + var(--hero-fade));
    display: flex;
    align-items: flex-end;
    overflow: hidden;
    margin-top: calc(-1 * var(--weeb-nav-height, 60px));
    background: var(--weeb-bg-elevated);
  }

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

  /* Sized to the below-fold band exactly, and eased on a smoothstep ramp: a
     linear two-stop gradient begins fading at constant slope and the eye reads
     that onset as a horizontal seam. */
  .hero-scrim-bottom {
    position: absolute;
    inset: auto 0 0 0;
    height: var(--hero-fade);
    z-index: 2;
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


  .hero-stage {
    position: relative;
    z-index: 3;
    width: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 32px;
    padding: 0 32px calc(32px + var(--hero-fade)) 32px;
  }

  .hero-panel,
  .hero-aside {
    background: var(--weeb-panel-bg, var(--weeb-surface));
    backdrop-filter: var(--weeb-panel-blur);
    -webkit-backdrop-filter: var(--weeb-panel-blur);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius-lg, 12px);
    box-shadow: var(--weeb-shadow-card, 0 12px 32px oklch(0% 0 0 / 0.4));
    padding: 20px;
  }
  .hero-panel {
    flex: 0 1 auto;
    max-width: min(560px, calc(100vw - 460px));
  }

  /* Poster and title, side by side. The pair is the show's identity; the poster
     carries no text so it needs no width of its own beyond being recognisable. */
  .hero-identity {
    display: flex;
    align-items: center;
    gap: 20px;
  }
  .hero-identity-text {
    flex: 1 1 auto;
    /* Without this a long untruncated title refuses to shrink and pushes the
       poster out of the panel. */
    min-width: 0;
  }

  /* The band under the identity pair, centred. Centring is what makes it read as
     a caption to the pair above rather than a second column of its own. */
  .hero-panel-body {
    margin-top: 18px;
    text-align: center;
  }
  .hero-panel-body :global(.hero-tags),
  .hero-panel-body :global(.platforms-container) {
    justify-content: center;
  }
  .hero-panel-body .hero-actions {
    display: flex;
    justify-content: center;
  }
  .hero-poster {
    flex: 0 0 auto;
    width: 150px;
    aspect-ratio: 2 / 3;
    border-radius: var(--weeb-radius);
    overflow: hidden;
    background: var(--weeb-surface);
    box-shadow: var(--weeb-shadow-card);
  }
  /* :global because SafeImage renders the img itself. */
  .hero-poster :global(.hero-poster-img) {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
  }
  .hero-aside {
    flex: 0 0 auto;
    width: 320px;
  }

  /* The band under the identity row. Tags, watch-on marks and the action are
     about the show, not about its name, so they get the panel's width instead
     of the text column's -- which is what leaves the space beside the poster
     empty rather than stranded. */
  .hero-panel-body {
    margin-top: 16px;
  }

  .hero-actions {
    margin-top: 16px;
  }

  /* Next-episode block: the schedule leads the data panel. */
  /* No trailing rule any more: the border and the padding under it existed to
     separate the schedule from the ranking beneath it, and that has moved to the
     quick-info bar. Left in place it drew a line under the last line of the
     panel. */
  .hero-next {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .hero-next-label {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--weeb-fg-secondary);
  }
  .hero-next-countdown {
    font-family: var(--weeb-font-mono);
    font-size: 20px;
    font-weight: 500;
    letter-spacing: 0.02em;
    color: var(--weeb-fg);
  }
  .hero-next-ep,
  .hero-next-when {
    font-family: var(--weeb-font-mono);
    font-size: 12px;
    letter-spacing: 0.02em;
    color: var(--weeb-fg-secondary);
  }


  @media (max-width: 1024px) {
    .hero-stage {
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
      padding: 0 12px calc(16px + var(--hero-fade)) 12px;
    }
    .hero-panel { max-width: none; }
    .hero-aside { width: auto; }

    /* Phones: the two stacked panels were taking 608px of a 796px viewport and
       left barely a third of the banner showing. Everything below tightens the
       stage so the artwork keeps the majority of the screen. */
    .hero-panel,
    .hero-aside { padding: 14px; }
    .hero-identity { gap: 14px; }
    /* 96px is a phone size. This block runs to 1024px, where the panel is full
       width and a 96px poster beside a ~900px column stops being the subject and
       becomes a stamp, so it scales with the room it is given. */
    .hero-poster { width: clamp(96px, 12vw, 148px); }
    .hero-panel .hero-title { margin-bottom: 2px; }
    .hero-panel .hero-meta { margin-top: 6px; }
    .hero-panel-body { margin-top: 12px; }
    .hero-panel .hero-tags { margin-bottom: 10px; }
    .hero-panel .hero-actions { margin-top: 10px; }

    /* The schedule collapses from a four-row block to one line. It is the same
       information -- state, episode, air time, countdown -- read across instead
       of down. */
    .hero-next {
      flex-direction: row;
      align-items: baseline;
      flex-wrap: wrap;
      gap: 8px;
    }
    .hero-next-countdown { font-size: 15px; }
    .hero-next-label {
      font-size: 11px;
      letter-spacing: 0.05em;
    }



    /* Watch-on marks were 38px squares; they are recognisable well below that
       and were the tallest thing in the panel after the title. */
    .hero-panel :global(.platform-link),
    .hero-panel :global(.platform-icon) {
      width: 28px;
      height: 28px;
    }
    /* Stacked, the two panels ate 695px of an 844px screen and left almost no
       artwork. The details list is the bulk of it and is the most redundant part
       here: aired / rating / source / studio repeat in the Information section
       below, and episodes / duration are chips in the quick-info bar. The
       schedule and the ranking stay, because neither is repeated above the fold. */
  }
  @media (max-width: 768px) {
    .hero-banner { --hero-fade: 70px; }
    .hero-scrim-top { height: 120px; }
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
    /* No mask. The old layout treated key art as faint texture behind a solid
       page, so it was capped at 35% opacity at the top and faded to nothing by
       the bottom. Here the artwork IS the banner; legibility comes from the top
       scrim and the panels, not from hiding the image. */
  }



  /* Was .hero-eyebrow, above the title. Below it now, so it reads as a
     qualifier rather than a label announcing the heading. Uppercase mono is
     kept: format, year and studio are catalogue facts, and the mono numeral
     rule already governs the year. */
  /* Its own line, with room on both sides. It sits between the meta line and
     the tag row and had margin above but none below, so the tags butted
     straight into it -- and at 14px it was also the largest thing in that stack
     after the title, which is more weight than "what this adapts" is asking
     for. Sized to sit with the meta line it follows, not to compete with it. */
  .hero-source {
    margin: 12px 0 14px;
    font-size: 14px;
    line-height: 1.5;
  }
  .hero-source-label {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--weeb-fg-muted);
    margin-right: 8px;
  }
  /* accent-text, not accent: the fill value fails AA at label size on this
     ground, which is the whole reason the two exist separately. */
  .hero-source-link {
    color: var(--weeb-accent-text);
    /* Underlined at rest, not only on hover. Coloured text sitting among other
       coloured text does not read as a link -- the underline is the only thing
       that says it can be clicked before you point at it. */
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-decoration-color: color-mix(in oklch, var(--weeb-accent-text) 45%, transparent);
    text-underline-offset: 3px;
    transition: text-decoration-color 0.15s ease, color 0.15s ease;
  }
  .hero-source-link:hover,
  .hero-source-link:focus-visible {
    color: var(--weeb-fg);
    text-decoration-color: currentColor;
  }

  .hero-meta {
    font-family: var(--weeb-font-mono);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.1em;
    color: var(--weeb-fg-muted);
    text-transform: uppercase;
    margin-top: 8px;
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
    color: var(--weeb-accent-text);
    background: color-mix(in oklch, var(--weeb-accent), transparent 85%);
  }





  /* ===========================
     QUICK INFO BAR
  =========================== */
  .quick-info {
    width: 100%;
    padding: 0 var(--weeb-section-px, 48px);
    position: relative;
    z-index: 2;
    margin-top: -16px;
  }

  .quick-info__inner {
    display: flex;
    align-items: center;
    /* Not space-between: at 2,526px that pinned the fact chips and the tracking
       controls to opposite ends of the bar with 1,539px of nothing between them.
       They are one cluster and now read as one. */
    justify-content: flex-start;
    gap: 24px;
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
    flex: 0 1 auto;
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
    color: var(--weeb-accent-text);
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
     STICKY HEADER
  =========================== */
  /* Full width with the section gutter, the same as .main-content and
     .tab-bar-inner. This used to be max-w-screen-2xl with its own 24px padding,
     which left the title and the Add-to-list button floating in a centred
     1,536px column while everything below them ran edge to edge. */
  .sticky-header-inner {
    width: 100%;
    padding: 8px var(--weeb-section-px, 48px);
  }

  /* ===========================
     FLOATING TAB BAR — button styles stay inline in markup (they were written that way
     to survive Astro's ViewTransition CSS loss). The container lives here because it
     needs a media query, which an inline style attribute cannot express.
  =========================== */
  .tab-bar-inner {
    width: 100%;
    padding: 0 var(--weeb-section-px, 48px);
    display: flex;
    align-items: center;
    gap: 0;
  }

  /* The tabs are nowrap and there can be four of them with count badges, which is
     wider than a small phone. Scroll them inside the bar rather than letting them
     widen the document — an overflowing tab bar scrolls the whole page sideways. */
  @media (max-width: 768px) {
    .tab-bar-inner {
      overflow-x: auto;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
    }
    .tab-bar-inner::-webkit-scrollbar {
      display: none;
    }
    .tab-bar-inner > button {
      flex: none;
    }
  }

  /* ===========================
     NEXT EPISODE BANNER
  =========================== */
  /* next-ep-banner and tracking-bar styles removed — now using quick-info */

  /* ===========================
     MAIN CONTENT
  =========================== */
  /* Full width with the section gutter, matching the homepage. The hero runs
     edge to edge; a 1440px column underneath it left 1,086px of empty margin on
     a wide monitor and made the two halves of the page look unrelated.
     Everything that is READ keeps its own measure cap -- width is for content
     that tiles, not for lines of prose. */
  .main-content {
    width: 100%;
    padding: 0 var(--weeb-section-px, 48px);
  }

  .content-single {
    display: flex;
    flex-direction: column;
    gap: var(--weeb-section-py, 40px);
    padding: var(--weeb-section-py, 40px) 0 20px;
  }

  /* .content-section — each section is a clean block; no styles needed */

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
  /* An explicit column count, not auto-fill. This is seven fixed rows of
     reference data whose length is known, so auto-fill's answer at 2,526px was
     nine columns -- one 48px-tall strip with two empty bordered cells -- rather
     than a shape anyone chose. It is bounded for the same reason: it stops
     growing instead of stretching.

     Dividers are per-cell borders on the leading edges, pulled back over the
     preceding cell by a matching negative margin. Three properties fall out of
     that and all three matter here: the borders never occupy layout space, the
     first row's and first column's borders land outside the padding box and are
     clipped by overflow:hidden so the container's own 1px frame is not doubled,
     and a cell that does not exist draws nothing -- so a partial final row is
     simply the container's background rather than a lighter block. Gap-drawn
     hairlines get the first two but not the third, and there is no CSS that
     spans a filler across an unknown remainder. */
  .info-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    max-width: 1200px;
    background: var(--weeb-bg-elevated);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius-lg);
    overflow: hidden;
  }
  @media (min-width: 640px) {
    .info-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (min-width: 1024px) {
    /* Seven items over four columns is two rows with one empty cell. */
    .info-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  .info-item {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 16px;
    padding: 14px 20px;
    background: var(--weeb-bg-elevated);
    border-left: 1px solid var(--weeb-border);
    border-top: 1px solid var(--weeb-border);
    margin: -1px 0 0 -1px;
  }

  .info-item--full {
    grid-column: 1 / -1;
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
  /* Underlined at rest. This value sits in a grid of plain values, so colour
     alone would not tell a reader that this one row goes somewhere. */
  .info-value--link {
    color: var(--weeb-accent-text);
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-decoration-color: color-mix(in oklch, var(--weeb-accent-text) 45%, transparent);
    text-underline-offset: 3px;
    transition: text-decoration-color 0.15s ease, color 0.15s ease;
  }
  .info-value--link:hover,
  .info-value--link:focus-visible {
    color: var(--weeb-fg);
    text-decoration-color: currentColor;
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
     RESPONSIVE -- 768px
  =========================== */
  @media (max-width: 768px) {



    .hero-tags {
      justify-content: center;
    }



    /* No gutter override here. Both already read --weeb-section-px, and pinning
       them to 16px between 481 and 768 put the content 8px left of the tab bar
       and the hero panel -- three left edges on one page. The token steps at
       1024 and 480 for every surface at once. */
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

  }

  /* ===========================
     RESPONSIVE -- 480px
  =========================== */
  @media (max-width: 480px) {
    .hero-title {
      font-size: 24px;
    }



    .quick-info {
      margin-top: -8px;
    }
  }
</style>
