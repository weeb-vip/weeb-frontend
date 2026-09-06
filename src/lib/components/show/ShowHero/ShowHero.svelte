<script lang="ts">
  import type { Snippet } from 'svelte';
  import KeyArtStage from '$lib/components/show/KeyArtStage';
  import ShowIdentityPanel from '$lib/components/show/ShowIdentityPanel';

  /**
   * The show page's hero: the identity panel on panel glass, with the schedule
   * panel beside it, standing on the key-art stage.
   *
   * The stage itself -- full-bleed artwork, the scrim under the nav, the fade
   * band below the fold, the load fade -- is `KeyArtStage`, which the homepage
   * banner and the series page also stand on. This file is what is above it.
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

<KeyArtStage
  ariaLabel="Anime overview"
  sources={imageSources}
  {loaded}
  fade="100px"
  fadeMobile="70px"
  scrimTopMobile="120px"
  textScrim={false}
  stage={false}
  onChosen={onArtChosen}
>
  <div class="hero-stage">
    <ShowIdentityPanel {anime} {title} {seasonText} {seriesLink} {studio} />
    {#if aside}{@render aside()}{/if}
  </div>
</KeyArtStage>

<style>
  /* Its own stage rather than the one KeyArtStage offers: two panels side by
     side that stack below 1024px, which is this page's layout and not the
     backdrop's. `--art-fade` is the stage's resolved below-fold band -- what is
     bottom-anchored here offsets by it, or the dissolve eats into the panels. */
  .hero-stage {
    position: relative;
    z-index: 3;
    width: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 32px;
    padding: 0 32px calc(32px + var(--art-fade)) 32px;
  }

  @media (max-width: 1024px) {
    .hero-stage {
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
      padding: 0 12px calc(16px + var(--art-fade)) 12px;
    }
  }
</style>
