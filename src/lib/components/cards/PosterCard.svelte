<script lang="ts">
  import type { Snippet } from 'svelte';
  import SafeImage from '$lib/components/primitives/SafeImage.svelte';
  import { getSafeImageUrl } from '$lib/utils/image';
  import { animeHref } from '$lib/services/utils';
  import { normalizeStatus } from '$lib/utils/status';
  import AiringIndicator from '$lib/components/primitives/AiringIndicator.svelte';
  import Chip from '$lib/components/primitives/Chip.svelte';
  import Score from '$lib/components/primitives/Score.svelte';
  import StatusMarker from '$lib/components/primitives/StatusMarker.svelte';
  import { realCardTracking, type CardTrackingPort } from './Card.bloc.svelte';

  /**
   * Presentational -- no bloc. The homepage renders 54 of these; anything that
   * fetched or held state here would do so 54 times over -- which is also why
   * the analytics ping arrives as Card.bloc's shared port rather than as a
   * per-card bloc, and why the title arrives already resolved from whoever
   * owns the title-language preference.
   */
  let {
    id,
    // Optional: callers that have not been given the slug yet fall back to
    // /show/<id>, which permanently redirects.
    slug = undefined,
    title,
    image,
    // Which CDN folder the poster lives in. Anime posters are the default; works
    // are stored under works/ by image-sync, and passing the id without this
    // would ask the CDN for an anime poster that does not exist.
    imagePath = 'posters',
    score = null,
    status = null,
    sub = '',
    href = '',
    genres = [],
    description = '',
    episodeCount = null,
    onList = null,
    /** Anything a call site wants under the sub-line -- a progress bar, a control. */
    children,
    track = realCardTracking,
  }: {
    id: string;
    slug?: string | null | undefined;
    title: string;
    image: string;
    imagePath?: string;
    score?: number | string | null;
    status?: string | null;
    sub?: string;
    href?: string;
    genres?: string[];
    description?: string;
    episodeCount?: number | null;
    /** The viewer's own list status, if the show is on it. */
    onList?: string | null;
    children?: Snippet;
    track?: CardTrackingPort;
  } = $props();

  const normalizedStatus = $derived(normalizeStatus(onList));

  // Green is airing, amber is upcoming -- and nothing else is either. The card
  // used to draw the two as its own pair of dots while AnimeCard drew "airing
  // now" in amber, which is the colour this one uses for "not out yet".
  const airingState = $derived.by<'airing' | 'upcoming' | null>(() => {
    if (status === 'CURRENTLY_AIRING' || status === 'airing') return 'airing';
    if (status === 'upcoming' || status === 'NOT_YET_RELEASED') return 'upcoming';
    return null;
  });

  // Prefer TheTVDB's 680x1000 series poster over the scraper's MyAnimeList
  // image, which MAL serves at 225px wide -- soft on any 2x display at card
  // size, and this component renders 54 times on the homepage alone. Falls back
  // per-anime, so the shows TheTVDB does not carry are unaffected.
  //
  // Costs no extra request: SafeImage resolves candidates in order and stops at
  // the first that loads.
  const posterSources = $derived(
    image ? [getSafeImageUrl(image, imagePath), getSafeImageUrl(image)] : []
  );
</script>

<a
  class="poster-card"
  href={href || animeHref({ id, slug })}
  onclick={() => track(id, title)}
>
  <div class="poster">
    <SafeImage
      sources={posterSources}
      alt={title}
      className="poster-img"
      fallbackSrc="/assets/not found.jpg"
      placeholderTitle={title}
      cdnWidth={360}
    />
    {#if score}
      <span class="score-mark"><Score value={score} variant="badge" /></span>
    {/if}
    <!-- The corner opposite the score says one thing at a time: the viewer's
         own list status if the show is on it, otherwise where it is in its run. -->
    {#if normalizedStatus}
      <span class="list-mark"><StatusMarker status={normalizedStatus} /></span>
    {:else if airingState}
      <span class="airing-mark"><AiringIndicator state={airingState} /></span>
    {/if}
    <div class="hover-overlay" aria-hidden="true">
      <div class="hover-content">
        {#if description}
          <p class="hover-desc">{description.replace(/<[^>]*>/g, '').slice(0, 120)}{description.length > 120 ? '...' : ''}</p>
        {/if}
        <!-- No score here. It is already in the corner of this very poster:
             the card used to draw the same number twice, once mono without a
             star and once sans with one. -->
        {#if episodeCount}
          <div class="hover-meta">
            <span class="hover-meta-item">{episodeCount} episodes</span>
          </div>
        {/if}
        {#if genres.length > 0}
          <div class="hover-genres">
            {#each genres.slice(0, 3) as genre}
              <Chip label={genre} size="sm" />
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
  <div class="poster-title">{title}</div>
  {#if sub}
    <div class="poster-sub">{sub}</div>
  {/if}
  {@render children?.()}
</a>

<style>
  .poster-card {
    display: flex;
    flex-direction: column;
    width: 100%;
    cursor: pointer;
    text-decoration: none;
    color: inherit;
  }
  .poster {
    aspect-ratio: 2/3;
    width: 100%;
    border-radius: var(--weeb-radius);
    background: var(--weeb-surface);
    overflow: hidden;
    position: relative;
    transition: transform 0.2s, box-shadow 0.2s;
  }
  @media (hover: hover) and (pointer: fine) {
    .poster-card:hover .poster {
      transform: translateY(-4px);
      box-shadow: var(--weeb-shadow-card);
    }
  }
  .poster :global(.poster-img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .poster :global(.poster-img img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  /* The card owns WHERE its corners are; Score, StatusMarker and
     AiringIndicator own what is drawn in them. */
  .score-mark {
    position: absolute;
    top: 8px;
    left: 8px;
    display: flex;
  }
  .airing-mark {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
  }
  .list-mark {
    position: absolute;
    top: 0;
    right: 8px;
    display: flex;
  }
  .hover-overlay {
    position: absolute;
    inset: 0;
    /* Off --weeb-scrim, which the score badge eight lines up already uses. The
       four stops were raw oklch(0% 0 0 / a) -- the same colour, written out by
       hand, which is exactly what the token exists to stop. */
    background: linear-gradient(
      to top,
      var(--weeb-scrim) 0%,
      color-mix(in oklch, var(--weeb-scrim) 90%, transparent) 40%,
      color-mix(in oklch, var(--weeb-scrim) 56%, transparent) 70%,
      color-mix(in oklch, var(--weeb-scrim) 22%, transparent) 100%
    );
    backdrop-filter: blur(2px);
    display: flex;
    align-items: flex-end;
    padding: 12px;
    opacity: 0;
    transition: opacity 0.25s;
    pointer-events: none;
  }
  @media (hover: hover) and (pointer: fine) {
    .poster-card:hover .hover-overlay {
      opacity: 1;
    }
  }
  .hover-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }
  .hover-desc {
    font-size: 12px;
    line-height: 1.4;
    color: var(--weeb-fg);
    display: -webkit-box;
    -webkit-line-clamp: 4;
    line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .hover-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--weeb-fg-secondary);
  }
  .hover-meta-item {
    white-space: nowrap;
  }
  .hover-genres {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .poster-title {
    margin-top: 8px;
    /* Title step. Was 13/500 -- a size the ramp does not define -- and 12px on a
       phone, identical to the metadata beneath it, so the card had no internal
       hierarchy at the size most people read it. */
    font-size: 15px;
    font-weight: 600;
    line-height: 1.3;
    min-height: calc(2 * 1.3em);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  /* Numeral step: "28 ep · 2023" is a measured value, and the Mono Numeral Rule
     puts every count and date in the mono face. Set in the sans it read as a
     second title rather than as metadata. */
  .poster-sub {
    font-family: var(--weeb-font-mono);
    font-size: 12px;
    color: var(--weeb-fg-muted);
    margin-top: 2px;
  }

  /* --- Mobile --- */
  @media (max-width: 480px) {
    .poster-title {
      font-size: 15px;
      margin-top: 6px;
      min-height: calc(2 * 1.3em);
    }
    .poster-sub {
      font-size: 12px;
    }
    .score-mark {
      top: 5px;
      left: 5px;
    }
    .airing-mark {
      top: 5px;
      right: 5px;
    }
  }
</style>
