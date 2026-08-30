<script lang="ts">
  /*
    The source-work page: /manga/<slug>.

    Built in the anime detail page's grammar rather than a new one — full-bleed
    art behind a glass panel, a stats strip under it, then sections down the
    page. A work is a sibling of an anime in the model and should read as one on
    screen; inventing a second layout for it would say they were different kinds
    of thing.

    Where it deliberately differs: a work has no schedule. The anime hero earns
    its second panel with a countdown, and there is nothing here that is
    time-sensitive, so the aside is gone and the panel stands alone.
  */
  import SafeImage from './SafeImage.svelte';
  import PosterGrid from './PosterGrid.svelte';
  import PosterCard from './PosterCard.svelte';
  import { getSafeImageUrl } from '../utils/image';
  import { preferencesStore, getAnimeTitle } from '../stores/preferences';

  export let work: any = null;
  export let ssrError: string | null = null;

  /** MANGA -> Manga, LIGHT_NOVEL -> Light novel. The wire value is an enum-ish
      string; the page says it the way a reader would. */
  function readableType(value: string | null | undefined): string {
    if (!value) return 'Work';
    const words = value.toLowerCase().split('_');
    return words[0].charAt(0).toUpperCase() + words[0].slice(1) + (words.length > 1 ? ' ' + words.slice(1).join(' ') : '');
  }

  function yearOf(value: string | null | undefined): string | null {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : String(parsed.getUTCFullYear());
  }

  /** "1997 – 2008", "1997 – ongoing", or "1997". Runs to a year rather than a
      date: a publication that spans a decade is not made clearer by its day. */
  function published(from: string | null | undefined, to: string | null | undefined, status: string | null | undefined): string | null {
    const start = yearOf(from);
    if (!start) return null;
    const end = yearOf(to);
    if (end && end !== start) return `${start} – ${end}`;
    if (end) return start;
    // No end date and still running reads as ongoing; no end date on a finished
    // work means we simply do not know, and inventing a dash implies we do.
    return status && status.toLowerCase().includes('publish') ? `${start} – ongoing` : start;
  }

  /** Thousands separators on counts. The design system sets every number the
      product is accountable for in mono; grouping is what makes six figures
      scannable at that size. */
  function grouped(value: number | null | undefined): string | null {
    return value === null || value === undefined ? null : value.toLocaleString('en-US');
  }

  $: title = work?.titleEn || work?.titleJp || 'Untitled';
  $: hasJapaneseTitle = work?.titleJp && work.titleJp !== work?.titleEn;
  // The cover, from our CDN under /works/<id> — the same path anime posters
  // take. imageUrl on the record is MyAnimeList's own host and is kept only as
  // the last fallback, for a work whose cover image-sync has not fetched yet.
  $: coverSources = work
    ? [getSafeImageUrl(work.id, 'works'), work.imageUrl].filter(Boolean) as string[]
    : [];
  $: adaptations = work?.adaptations ?? [];
  $: authors = (work?.authors ?? []) as string[];
  $: publishedRange = published(work?.publishedFrom, work?.publishedTo, work?.status);
  $: facts = [
    { label: 'Volumes', value: grouped(work?.volumes) },
    { label: 'Chapters', value: grouped(work?.chapters) },
    { label: 'Score', value: work?.score != null ? Number(work.score).toFixed(2) : null },
    { label: 'Ranked', value: work?.ranking != null ? `#${grouped(work.ranking)}` : null },
    { label: 'Members', value: grouped(work?.members) },
    { label: 'Favourites', value: grouped(work?.favorites) }
  ].filter((f) => f.value !== null && f.value !== undefined);
</script>

{#if ssrError}
  <div class="state">
    <h1 class="state-title">This page could not load</h1>
    <p class="state-body">{ssrError}</p>
    <a class="state-action" href="/">Back to home</a>
  </div>
{:else if work}
  <article class="work">
    <section class="hero" aria-label="{title} overview">
      {#if coverSources.length > 0}
        <div class="hero-bg" aria-hidden="true">
          <SafeImage
            sources={coverSources}
            alt=""
            loading="eager"
            priority={true}
            fallbackSrc="/assets/not found.jpg"
            perTryTimeoutMs={3000}
            className="hero-bg-img"
            style=""
          />
        </div>
      {/if}
      <div class="hero-scrim-top" aria-hidden="true"></div>
      <div class="hero-scrim-bottom" aria-hidden="true"></div>

      <div class="hero-stage">
        <div class="hero-panel">
          <div class="hero-identity">
            <div class="hero-cover">
              <SafeImage
                sources={coverSources}
                alt=""
                className="hero-cover-img"
                fallbackSrc="/assets/not found.jpg"
                cdnWidth={300}
              />
            </div>
            <div class="hero-identity-text">
              <h1 class="hero-title">{title}</h1>
              {#if hasJapaneseTitle}
                <p class="hero-title-jp" lang="ja">{work.titleJp}</p>
              {/if}
            </div>
          </div>

          <div class="hero-body">
            <p class="hero-meta">
              {readableType(work.type)}
              {#if publishedRange}<span class="dot" aria-hidden="true">·</span><span class="num">{publishedRange}</span>{/if}
              {#if work.status}<span class="dot" aria-hidden="true">·</span>{work.status}{/if}
            </p>

            {#if authors.length > 0 || work.serialization || work.demographic}
              <div class="hero-credits">
                {#if authors.length > 0}
                  <p class="credit"><span class="credit-label">By</span> {authors.join(', ')}</p>
                {/if}
                {#if work.serialization}
                  <p class="credit"><span class="credit-label">Ran in</span> {work.serialization}</p>
                {/if}
                {#if work.demographic}
                  <p class="credit"><span class="credit-label">For</span> {work.demographic}</p>
                {/if}
              </div>
            {/if}
          </div>
        </div>
      </div>
    </section>

    {#if facts.length > 0}
      <div class="facts">
        <dl class="facts-inner">
          {#each facts as fact}
            <div class="fact">
              <dt class="fact-label">{fact.label}</dt>
              <dd class="fact-value">{fact.value}</dd>
            </div>
          {/each}
        </dl>
      </div>
    {/if}

    <div class="body">
      {#if work.synopsis}
        <section class="section" aria-labelledby="synopsis-heading">
          <h2 class="section-title" id="synopsis-heading">Synopsis</h2>
          <p class="synopsis">{work.synopsis}</p>
        </section>
      {/if}

      <section class="section" aria-labelledby="adaptations-heading">
        <h2 class="section-title" id="adaptations-heading">Anime adaptations</h2>
        {#if adaptations.length > 0}
          <PosterGrid>
            {#each adaptations as anime (anime.id)}
              <PosterCard
                id={anime.id}
                slug={anime.slug}
                title={getAnimeTitle(anime, $preferencesStore.titleLanguage)}
                image={getSafeImageUrl(anime.id)}
                score={anime.rating}
                status={anime.animeStatus}
                genres={anime.tags || []}
                episodeCount={anime.episodeCount}
                sub={yearOf(anime.startDate) || ''}
              />
            {/each}
          </PosterGrid>
        {:else}
          <!-- The ordinary case, not a gap. MyAnimeList holds far more manga
               than there are anime made from one, so most works genuinely have
               no adaptation and the page should say so plainly rather than
               apologise or leave a hole where a grid was. -->
          <p class="empty">
            No anime has been made from this {readableType(work.type).toLowerCase()} — or none that we know of yet.
          </p>
        {/if}
      </section>
    </div>
  </article>
{/if}

<style>
  .work {
    min-height: 100vh;
    background: var(--weeb-bg);
    color: var(--weeb-fg);
  }

  /* Browser surfaces. Scoped here rather than global: the rest of the product
     still ships the defaults, and changing every page's selection colour is not
     this page's decision to make. */
  .work ::selection {
    background: var(--weeb-accent);
    color: white;
  }
  .work :focus-visible {
    outline: 2px solid var(--weeb-accent);
    outline-offset: 3px;
    border-radius: var(--weeb-radius-sm, 4px);
  }

  /* ---- hero ---- */
  .hero {
    position: relative;
    min-height: 62svh;
    display: flex;
    align-items: flex-end;
    overflow: hidden;
  }
  .hero-bg {
    position: absolute;
    inset: 0;
    z-index: 0;
  }
  /* SafeImage puts className on its wrapper div, not on the image element,
     which always carries w-full h-full object-cover. So the treatment goes on
     the wrapper and only sizing goes on the image itself. */
  .hero-bg :global(.hero-bg-img) {
    width: 100%;
    height: 100%;
    /* The cover is a 2:3 portrait doing the job of a wide banner. Scaling it
       past the frame and blurring it is what keeps it from being a stretched
       poster with hard edges; the sharp copy sits in the panel a few hundred
       pixels away, so this layer only has to carry colour and light. */
    transform: scale(1.2);
    filter: blur(36px) saturate(1.1);
    opacity: 0.5;
  }
  .hero-bg :global(.hero-bg-img img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .hero-scrim-top {
    position: absolute;
    inset: 0 0 auto 0;
    height: calc(var(--weeb-nav-height, 60px) * 2.2);
    background: linear-gradient(to bottom, oklch(0% 0 0 / 0.75), transparent);
    z-index: 1;
  }
  .hero-scrim-bottom {
    position: absolute;
    inset: auto 0 0 0;
    height: 55%;
    background: linear-gradient(to top, var(--weeb-bg) 12%, transparent);
    z-index: 1;
  }
  .hero-stage {
    position: relative;
    z-index: 2;
    width: 100%;
    padding: calc(var(--weeb-nav-height, 60px) + var(--weeb-section-py, 40px)) var(--weeb-section-px, 48px) var(--weeb-section-py, 40px);
  }
  .hero-panel {
    max-width: 640px;
    padding: 20px;
    border-radius: var(--weeb-radius-lg, 12px);
    background: var(--weeb-panel-bg);
    backdrop-filter: var(--weeb-panel-blur);
    -webkit-backdrop-filter: var(--weeb-panel-blur);
    box-shadow: var(--weeb-shadow-card);
  }
  .hero-identity {
    display: flex;
    gap: 18px;
    align-items: flex-end;
  }
  .hero-cover {
    flex: 0 0 116px;
    aspect-ratio: 2 / 3;
    border-radius: var(--weeb-radius, 8px);
    overflow: hidden;
    box-shadow: var(--weeb-shadow-poster);
  }
  .hero-cover :global(.hero-cover-img),
  .hero-cover :global(.hero-cover-img img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .hero-identity-text {
    min-width: 0;
  }
  .hero-title {
    /* The documented Display step. The anime hero title sits two pixels under
       it at 42px, which is drift rather than a decision -- a work and an anime
       are siblings and their pages should measure the same, so this follows the
       design system rather than the nearest neighbour. */
    font-size: clamp(28px, 4vw, 44px);
    font-weight: 800;
    line-height: 1.15;
    letter-spacing: -0.025em;
    margin: 0;
    text-wrap: balance;
  }
  .hero-title-jp {
    margin: 6px 0 0;
    font-size: 14px;
    line-height: 1.4;
    color: var(--weeb-fg-secondary);
  }
  .hero-body {
    margin-top: 18px;
  }
  .hero-meta {
    margin: 0;
    font-size: 14px;
    color: var(--weeb-fg-secondary);
  }
  .dot {
    margin: 0 8px;
    color: var(--weeb-fg-muted);
  }
  .num {
    font-family: var(--weeb-font-mono);
    font-size: 13px;
    letter-spacing: 0.02em;
  }
  .hero-credits {
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .credit {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
    color: var(--weeb-fg);
  }
  .credit-label {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--weeb-fg-muted);
    margin-right: 8px;
  }

  /* ---- facts strip ---- */
  .facts {
    position: relative;
    z-index: 2;
    margin-top: -12px;
    padding: 0 var(--weeb-section-px, 48px);
  }
  .facts-inner {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 28px;
    margin: 0;
    padding: 14px 18px;
    border-radius: var(--weeb-radius, 8px);
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
  }
  .fact {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .fact-label {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--weeb-fg-muted);
  }
  .fact-value {
    margin: 0;
    font-family: var(--weeb-font-mono);
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.02em;
    color: var(--weeb-fg);
  }

  /* ---- body ---- */
  .body {
    padding: var(--weeb-section-py, 40px) var(--weeb-section-px, 48px) calc(var(--weeb-section-py, 40px) * 2);
    display: flex;
    flex-direction: column;
    gap: calc(var(--weeb-section-py, 40px));
  }
  .section-title {
    font-size: 20px;
    font-weight: 700;
    line-height: 1.25;
    margin: 0 0 16px;
  }
  .synopsis {
    margin: 0;
    font-size: 14px;
    line-height: 1.6;
    color: var(--weeb-fg-secondary);
    max-width: 70ch;
    white-space: pre-line;
  }
  .empty {
    margin: 0;
    padding: 20px;
    font-size: 14px;
    line-height: 1.6;
    color: var(--weeb-fg-secondary);
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius, 8px);
    max-width: 70ch;
  }

  /* ---- error state ---- */
  .state {
    min-height: 60svh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: var(--weeb-section-py, 40px) var(--weeb-section-px, 48px);
    text-align: center;
    background: var(--weeb-bg);
  }
  .state-title {
    font-size: 20px;
    font-weight: 700;
    margin: 0;
    color: var(--weeb-fg);
  }
  .state-body {
    margin: 0;
    font-size: 14px;
    color: var(--weeb-fg-secondary);
    max-width: 60ch;
  }
  .state-action {
    margin-top: 8px;
    padding: 7px 18px;
    border-radius: var(--weeb-radius, 8px);
    background: var(--weeb-accent);
    color: white;
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
    transition: background 0.15s ease;
  }
  .state-action:hover {
    background: var(--weeb-accent-hover);
  }

  @media (max-width: 1024px) {
    .hero-panel { max-width: none; }
  }
  @media (max-width: 640px) {
    .hero { min-height: 54svh; }
    .hero-cover { flex-basis: 92px; }
    .hero-identity { gap: 14px; }
    .facts-inner { gap: 8px 20px; }
  }
</style>
