<script lang="ts">
  import AnimeActions from './AnimeActions.svelte';
  import SafeImage from './SafeImage.svelte';
  import StreamingPlatforms from './StreamingPlatforms.svelte';
  import { GetImageFromAnime, getYearUTC } from '../../services/utils';

  /**
   * Who this show is: the cover, the name, and the qualifiers that place it.
   *
   * Two bands. The poster and the name pair up top, because together they are
   * what identifies it. Everything else -- what kind of show it is, what it
   * adapts, its genres, where to watch it, and the one action -- belongs to the
   * show rather than to its name, so it sits below on the panel's full width
   * and centred. It was previously stacked inside a 221px column beside the
   * poster, where the tag rows wrapped and the action sat indented against
   * empty space.
   *
   * Presentational -- no bloc. Every string here is resolved by the page.
   */
  let {
    anime,
    title,
    /** "Season 2", or "Special". Empty for most of the catalogue. */
    seasonText = '',
    /** Where the season label points, when the series has a page. */
    seriesLink = '',
    studio = null,
  }: {
    anime: any;
    title: string;
    seasonText?: string;
    seriesLink?: string;
    studio?: string | null;
  } = $props();
</script>

<div class="hero-panel">
  <!-- The poster, which the page did not show anywhere. The artwork behind the
       hero is the wide banner; the 2:3 cover was only ever visible in the sticky
       header once you scrolled. It sits beside the identity text rather than
       above it so it costs no vertical space on a phone. -->
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
      <h1 class="hero-title">{title}</h1>
      {#if anime.titleJp}
        <!-- lang="ja": Japanese text inside a lang="en" document. Tells search
             engines which language it is, and screen readers which voice. -->
        <p class="hero-title-jp" lang="ja">{anime.titleJp}</p>
      {/if}
      <!-- Which run of the series this is: under the name, not in the qualifier
           line below. That line holds facts about the production -- format,
           year, studio -- while this says which part of the series you are
           looking at, which is part of identifying it. Absent for most of the
           catalogue: the season is derived from the air dates TheTVDB and
           MyAnimeList agree on, and that derivation refuses rather than
           guesses, so an unknown season renders as nothing at all. -->
      {#if seasonText}
        {#if seriesLink}
          <a class="hero-season hero-season-link" href={seriesLink}>{seasonText}</a>
        {:else}
          <p class="hero-season">{seasonText}</p>
        {/if}
      {/if}
    </div>
  </div>

  <div class="hero-panel-body">
    <!-- One element per qualifier, so the line breaks between them and never
         inside one. The separators are drawn by CSS between adjacent items, so
         an absent studio cannot strand a dot. -->
    <p class="hero-meta">
      <span class="hero-meta-item">{anime.type || 'TV'} Series</span>
      <span class="hero-meta-item">{getYearUTC(anime.startDate)}</span>
      {#if studio}
        <span class="hero-meta-item">{studio}</span>
      {/if}
    </p>

    <!-- What this adapts, when we know it. The link is the only way into a
         work's page from inside the catalogue, and it is what makes the two
         re-adaptations of one manga reachable from each other. -->
    {#if anime.sourceWork?.urlSlug}
      <p class="hero-source">
        <span class="hero-source-label">Adapted from</span>
        <a class="hero-source-link" href="/manga/{anime.sourceWork.urlSlug}">
          {anime.sourceWork.titleEn || anime.sourceWork.titleJp}
        </a>
      </p>
    {/if}

    {#if anime.tags && anime.tags.length > 0}
      <div class="hero-tags" role="list" aria-label="Genres">
        {#each anime.tags as tag}
          <span class="hero-tag" role="listitem">{tag}</span>
        {/each}
      </div>
    {/if}

    <StreamingPlatforms platforms={anime.streamingPlatforms} centerOnMobile />

    <div class="hero-actions">
      <AnimeActions {anime} variant="hero" />
    </div>
  </div>
</div>

<style>
  .hero-panel {
    flex: 0 1 auto;
    max-width: min(560px, calc(100vw - 460px));
    background: var(--weeb-panel-bg, var(--weeb-surface));
    backdrop-filter: var(--weeb-panel-blur);
    -webkit-backdrop-filter: var(--weeb-panel-blur);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius-lg, 12px);
    box-shadow: var(--weeb-shadow-card, 0 12px 32px oklch(0% 0 0 / 0.4));
    padding: 20px;
  }

  /* Poster and title, side by side. The pair is the show's identity; the poster
     carries no text so it needs no width beyond being recognisable. */
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
    font-weight: 400;
  }

  /* Accent, not muted: this is the one fact up here that is not the name, and
     it earns colour by being what a reader scans for when a series has several
     entries. */
  .hero-season {
    font-family: var(--weeb-font-mono);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--weeb-accent-text);
    margin-top: 6px;
  }
  /* The season doubles as the way into the series page, so it has to read as a
     control. It is already accent-coloured, which is exactly why colour cannot
     be the signal -- a bare link would look identical to the static label. */
  .hero-season-link {
    display: inline-block;
    text-decoration: underline;
    text-decoration-color: color-mix(in oklch, var(--weeb-accent-text) 40%, transparent);
    text-decoration-thickness: 1px;
    text-underline-offset: 4px;
  }
  .hero-season-link:hover,
  .hero-season-link:focus-visible {
    text-decoration-color: currentColor;
  }

  /* The band under the identity pair, centred. Centring is what makes it read
     as a caption to the pair above rather than a second column of its own.
     The gap between the name and this band, and the rhythm inside it, are these
     two numbers and nothing else -- they used to be the sum of whatever margins
     the children happened to carry, which compounded into a 40px gulf under the
     name while the meta line and the tags touched. */
  .hero-panel-body {
    margin-top: 20px;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .hero-panel-body > .hero-meta,
  .hero-panel-body > .hero-source,
  .hero-panel-body > .hero-tags,
  .hero-panel-body > .hero-actions {
    margin: 0;
  }
  .hero-panel-body .hero-tags,
  .hero-panel-body :global(.platforms-container) {
    justify-content: center;
  }
  .hero-panel-body .hero-actions {
    display: flex;
    justify-content: center;
  }

  .hero-meta {
    font-family: var(--weeb-font-mono);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.1em;
    color: var(--weeb-fg-muted);
    text-transform: uppercase;
    /* Flex rather than a text run: wrapping happens between qualifiers instead
       of at whatever space falls at the edge. */
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    row-gap: 2px;
  }
  .hero-meta-item {
    white-space: nowrap;
  }
  /* Between adjacent items only, so the first on the line carries no dot and a
     missing qualifier removes its separator with it. */
  .hero-meta-item + .hero-meta-item::before {
    content: '\00b7';
    margin: 0 0.5em;
  }

  /* Sized to sit with the meta line it follows, not to compete with it. */
  .hero-source {
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
     ground, which is the whole reason the two exist separately. Underlined at
     rest -- coloured text sitting among other coloured text does not read as a
     link before you point at it. */
  .hero-source-link {
    color: var(--weeb-accent-text);
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

  .hero-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
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
  }
  .hero-tag:hover {
    border-color: var(--weeb-accent);
    color: var(--weeb-accent-text);
    background: color-mix(in oklch, var(--weeb-accent), transparent 85%);
  }

  /* Phones and tablets: the two stacked panels were taking 608px of a 796px
     viewport and left barely a third of the banner showing. Everything here
     tightens the panel so the artwork keeps the majority of the screen. */
  @media (max-width: 1024px) {
    .hero-panel {
      max-width: none;
      padding: 14px;
    }
    .hero-identity {
      gap: 14px;
    }
    /* 96px is a phone size. This block runs to 1024px, where the panel is full
       width and a 96px poster beside a ~900px column stops being the subject
       and becomes a stamp, so it scales with the room it is given. */
    .hero-poster {
      width: clamp(96px, 12vw, 148px);
    }
    .hero-title {
      margin-bottom: 4px;
    }
    /* Only the two numbers the body is built from, so the rhythm tightens
       without any child gaining a margin of its own again. */
    .hero-panel-body {
      margin-top: 16px;
      gap: 10px;
    }
    /* Watch-on marks were 38px squares; they are recognisable well below that
       and were the tallest thing in the panel after the title. */
    .hero-panel :global(.platform-link),
    .hero-panel :global(.platform-icon) {
      width: 28px;
      height: 28px;
    }
  }

  @media (max-width: 768px) {
    .hero-tags {
      justify-content: center;
    }
  }

  @media (max-width: 480px) {
    .hero-title {
      font-size: 24px;
    }
  }
</style>
