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

    A view over the bloc: what the page is made of — cover and banner
    candidates, credits, stats, adaptations — is the bloc's call; this renders
    it and owns the treatment.
  */
  import SafeImage from './SafeImage.svelte';
  import PosterGrid from './PosterGrid.svelte';
  import PosterCard from './PosterCard.svelte';
  import EmptyState from './EmptyState.svelte';
  import ErrorBanner from './ErrorBanner.svelte';
  import WorkStatusControl from './WorkStatusControl.svelte';
  import ChapterProgress from './ChapterProgress.svelte';
  import { GetImageFromAnime } from '../../services/utils';
  import { MangaContentBloc, type Work } from './MangaContent.bloc.svelte';

  let {
    work = null,
    ssrError = null,
    /**
     * Defaults to a bloc reading this component's props, so the route call site
     * is unchanged and the server frame already has its facts and credits.
     */
    bloc = new MangaContentBloc({ source: () => ({ work, ssrError }) }),
  }: {
    work?: Work | null;
    ssrError?: string | null;
    bloc?: MangaContentBloc;
  } = $props();
</script>

{#if bloc.ssrError}
  <div class="state">
    <ErrorBanner message="This page could not load" detail={bloc.ssrError}>
      <a class="state-action" href="/">Back to home</a>
    </ErrorBanner>
  </div>
{:else if bloc.work}
  <article class="work">
    <section class="hero" aria-label="{bloc.title} overview">
      {#if bloc.heroSources.length > 0}
        <div class="hero-bg" class:hero-bg--banner={bloc.heroIsBanner} aria-hidden="true">
          <SafeImage
            sources={bloc.heroSources}
            alt=""
            loading="eager"
            priority={true}
            fallbackSrc="/assets/not found.jpg"
            perTryTimeoutMs={3000}
            className="hero-bg-img"
            style=""
            onChosen={(detail) => bloc.heroChosen(detail)}
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
                sources={bloc.coverSources}
                alt=""
                className="hero-cover-img"
                fallbackSrc="/assets/not found.jpg"
                cdnWidth={300}
              />
            </div>
            <div class="hero-identity-text">
              <h1 class="hero-title">{bloc.title}</h1>
              {#if bloc.japaneseTitle}
                <p class="hero-title-jp" lang="ja">{bloc.japaneseTitle}</p>
              {/if}
            </div>
          </div>

          <div class="hero-body">
            <!-- Directly under the title, where the equivalent control sits on
                 an anime page. Until now a manga page was somewhere to read
                 about a work and nowhere to put it. -->
            <div class="hero-track">
              <WorkStatusControl workId={bloc.work.id ?? ''} userWork={bloc.work.userWork ?? null} />
              {#if bloc.work.userWork}
                <ChapterProgress
                  workId={bloc.work.id ?? ''}
                  totalChapters={bloc.work.chapters ?? null}
                  userWork={bloc.work.userWork}
                />
              {/if}
            </div>

            <p class="hero-meta">
              {#each bloc.metaLine as part, i (i)}
                {#if i > 0}<span class="dot" aria-hidden="true">·</span>{/if}
                <span class:num={part.mono}>{part.label}</span>
              {/each}
            </p>

            {#if bloc.credits.length > 0}
              <!-- A definition list on a two-column grid, so the values line up
                   on one edge whatever the labels measure. "Author",
                   "Serialised in" and "Aimed at" are three different widths, and
                   inline labels left the values starting at three different
                   places. -->
              <dl class="hero-credits">
                {#each bloc.credits as credit (credit.label)}
                  <dt class="credit-label">{credit.label}</dt>
                  <dd class="credit-value">{credit.value}</dd>
                {/each}
              </dl>
            {/if}
          </div>
        </div>
      </div>
    </section>

    {#if bloc.facts.length > 0}
      <div class="facts">
        <dl class="facts-inner">
          {#each bloc.facts as fact (fact.label)}
            <div class="fact">
              <dt class="fact-label">{fact.label}</dt>
              <dd class="fact-value">{fact.value}</dd>
            </div>
          {/each}
        </dl>
      </div>
    {/if}

    <div class="body">
      {#if bloc.synopsis}
        <section class="section" aria-labelledby="synopsis-heading">
          <h2 class="section-title" id="synopsis-heading">Synopsis</h2>
          <p class="synopsis">{bloc.synopsis}</p>
        </section>
      {/if}

      <section class="section" aria-labelledby="adaptations-heading">
        <h2 class="section-title" id="adaptations-heading">Anime adaptations</h2>
        {#if bloc.adaptations.length > 0}
          <PosterGrid>
            {#each bloc.adaptations as anime (anime.id)}
              <PosterCard
                id={anime.id}
                slug={anime.slug}
                title={bloc.adaptationTitle(anime)}
                image={GetImageFromAnime(anime)}
                score={anime.rating}
                status={anime.animeStatus}
                genres={anime.tags || []}
                episodeCount={anime.episodeCount}
                sub={bloc.adaptationSubtitle(anime)}
              />
            {/each}
          </PosterGrid>
        {:else}
          <!-- The ordinary case, not a gap. MyAnimeList holds far more manga
               than there are anime made from one, so most works genuinely have
               no adaptation and the page should say so plainly rather than
               apologise or leave a hole where a grid was. -->
          <EmptyState
            variant="panel"
            size="compact"
            message={bloc.noAdaptationsMessage}
            class="adaptations-empty"
          />
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

  /* ---- hero ----
     The same banner the anime page uses: a full viewport of artwork starting
     under the transparent nav, with a fade band below the fold so it dissolves
     into the page ground instead of ending on a cut. A work page that stopped
     at two thirds of the screen read as a lesser kind of page. */
  .hero {
    --hero-fade: 100px;
    position: relative;
    min-height: calc(100svh + var(--hero-fade));
    display: flex;
    align-items: flex-end;
    overflow: hidden;
    margin-top: calc(-1 * var(--weeb-nav-height, 60px));
    background: var(--weeb-bg-elevated);
  }
  .hero-bg {
    position: absolute;
    inset: 0;
    z-index: 0;
  }
  /* SafeImage puts className on its wrapper div, not on the image element,
     which always carries w-full h-full object-cover. So the treatment goes on
     the wrapper and only sizing goes on the image itself. */
  /* The cover fallback: a 2:3 portrait doing a wide banner's job. Scaled past
     the frame and blurred so it does not read as a stretched poster with hard
     edges; the sharp copy sits in the panel a few hundred pixels away, so this
     layer only has to carry colour and light. */
  .hero-bg :global(.hero-bg-img) {
    width: 100%;
    height: 100%;
    transform: scale(1.2);
    filter: blur(36px) saturate(1.1);
    opacity: 0.5;
    transition: filter 0.4s ease, opacity 0.4s ease, transform 0.4s ease;
  }
  /* An adaptation's key art is already the right shape and is the best image
     the page has. It is shown, not smeared -- the scrims and the panel do the
     work of keeping text legible over it, exactly as they do on the anime hero. */
  .hero-bg--banner :global(.hero-bg-img) {
    transform: none;
    filter: none;
    opacity: 0.85;
  }
  .hero-bg :global(.hero-bg-img img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  /* Required, not decorative: it is what makes a transparent nav safe over key
     art of unknown colour. */
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
  /* Eased on a smoothstep ramp. A linear two-stop gradient begins fading at a
     constant slope and the eye reads that onset as a horizontal seam. */
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
    padding: 0 var(--weeb-section-px, 48px) calc(var(--weeb-section-py, 40px) + var(--hero-fade));
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
  .hero-track {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
    margin-bottom: 14px;
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
    display: grid;
    /* The label column sizes to the longest label, so every value shares one
       left edge. */
    grid-template-columns: auto 1fr;
    column-gap: 14px;
    row-gap: 5px;
    margin-bottom: 0;
  }
  .credit-label {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--weeb-fg-muted);
    /* Nudged down so a 12px uppercase label sits on the same optical line as
       the 14px value beside it. */
    padding-top: 2px;
  }
  .credit-value {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
    color: var(--weeb-fg);
    min-width: 0;
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
    padding: var(--weeb-section-py, 40px) var(--weeb-section-px, 48px)
      calc(var(--weeb-section-py, 40px) * 2);
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
  /* The shared EmptyState centres its copy across the full row; here it stands
     in a text column, so it is pulled back to the measure of the synopsis
     above it rather than floating in the middle of a wide page. */
  .section :global(.adaptations-empty) {
    max-width: 70ch;
    align-items: flex-start;
    text-align: left;
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
  .state-action {
    display: inline-block;
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
    .hero-panel {
      max-width: none;
    }
  }
  @media (max-width: 640px) {
    .hero-cover {
      flex-basis: 92px;
    }
    .hero-identity {
      gap: 14px;
    }
    .facts-inner {
      gap: 8px 20px;
    }
  }
</style>
