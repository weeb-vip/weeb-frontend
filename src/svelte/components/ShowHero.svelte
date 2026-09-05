<script lang="ts">
  import type { Snippet } from 'svelte';
  import SafeImage from './SafeImage.svelte';
  import ShowIdentityPanel from './ShowIdentityPanel.svelte';

  /**
   * The key-art stage: full-bleed artwork, a scrim only under the nav, a fade
   * band below the fold, and the identity panel on panel glass. Same stage as
   * the homepage banner -- the artwork is the ground, and legibility comes from
   * the scrim and the panels rather than from hiding the image.
   *
   * Presentational -- no bloc. The candidate list and "has it painted yet" are
   * the page's, because the sticky header uses the same first candidate.
   */
  let {
    anime,
    title,
    seasonText = '',
    seriesLink = '',
    studio = null,
    /** Ordered artwork candidates: the TheTVDB banner, then the poster. */
    imageSources = [],
    /** False until something has actually painted, so the art fades in. */
    loaded = false,
    onArtChosen,
    /** The schedule panel, when there is a schedule to show. */
    aside,
  }: {
    anime: any;
    title: string;
    seasonText?: string;
    seriesLink?: string;
    studio?: string | null;
    imageSources?: string[];
    loaded?: boolean;
    onArtChosen: () => void;
    aside?: Snippet;
  } = $props();
</script>

<section class="hero-banner" aria-label="Anime overview">
  {#if imageSources.length > 0}
    <div class="hero-banner__bg" style="opacity: {loaded ? 1 : 0};">
      <SafeImage
        sources={imageSources}
        alt=""
        loading="eager"
        priority={true}
        fallbackSrc="/assets/not found.jpg"
        perTryTimeoutMs={3000}
        className="hero-banner__bg-img"
        onChosen={onArtChosen}
      />
    </div>
  {/if}

  <div class="hero-scrim-top"></div>
  <div class="hero-scrim-bottom"></div>

  <div class="hero-stage">
    <ShowIdentityPanel {anime} {title} {seasonText} {seriesLink} {studio} />
    {#if aside}{@render aside()}{/if}
  </div>
</section>

<style>
  .hero-banner {
    /* Extra banner below the fold carrying the dissolve into the page ground,
       so the artwork does not end on a hard cut. Nothing of it shows at rest. */
    --hero-fade: 100px;
    position: relative;
    min-height: calc(100svh + var(--hero-fade));
    display: flex;
    align-items: flex-end;
    overflow: hidden;
    margin-top: calc(-1 * var(--weeb-nav-height, 60px));
    background: var(--weeb-bg-elevated);
  }

  .hero-banner__bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    transition: opacity 0.3s ease;
  }
  /* :global because SafeImage renders the img itself. No mask: the old layout
     treated key art as faint texture behind a solid page and capped it at 35%
     opacity; here the artwork IS the banner. */
  :global(.hero-banner__bg-img) {
    position: absolute;
    width: 100%;
    height: 100%;
    object-fit: cover;
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

  @media (max-width: 1024px) {
    .hero-stage {
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
      padding: 0 12px calc(16px + var(--hero-fade)) 12px;
    }
  }

  @media (max-width: 768px) {
    .hero-banner {
      --hero-fade: 70px;
    }
    .hero-scrim-top {
      height: 120px;
    }
  }
</style>
