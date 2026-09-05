<script lang="ts">
  import SafeImage from './SafeImage.svelte';
  import { getSafeImageUrl } from '../utils/image';

  /*
    The key-art stage from the show page: artwork as the ground, a scrim only
    under the nav, and a fade band below the fold so the image dissolves into
    the page rather than ending on a hard cut.

    Named for what it is rather than HeroBanner, which is taken by the
    homepage's banner -- that one owns a whole anime, its actions and its
    schedule, and is not a shell anything else can sit in. ShowContent still
    carries its own copy of this treatment: that hero also drives a sticky
    header and a load fade, so adopting this is a change worth making on its
    own rather than inside a feature.
  */

  /** Anime id. Artwork is banners/<id>, with that anime's poster as fallback. */
  export let imageId: string | null | undefined = null;
  /**
   * Full viewport suits a page whose subject is the artwork. A page whose
   * subject is a list wants to show some of the list.
   */
  export let minHeight = '100svh';

  // Both keyed by anime id: banners/<id> for the TheTVDB artwork synced by
  // thetvdb-enrichment, <id> at the root for the poster. Through
  // getSafeImageUrl so they follow config.cdn_url -- hardcoding the host meant
  // local and staging read production artwork, which hid staging having no
  // banners of its own.
  $: sources = imageId ? [getSafeImageUrl(imageId, 'banners'), getSafeImageUrl(imageId)] : [];

</script>

<section class="key-art" style="min-height: calc({minHeight} + var(--art-fade));">
  {#if sources.length > 0}
    <div class="key-art__bg">
      <SafeImage
        {sources}
        alt=""
        loading="eager"
        priority={true}
        fallbackSrc="/assets/not found.jpg"
        perTryTimeoutMs={3000}
        className="key-art__bg-img"
      />
    </div>
  {/if}

  <div class="key-art__scrim-top"></div>
  <div class="key-art__scrim-text"></div>
  <div class="key-art__scrim-bottom"></div>

  <div class="key-art__stage">
    <slot />
  </div>
</section>

<style>
  .key-art {
    /* The band below the fold carrying the dissolve into the page ground.
       Nothing of it shows at rest. */
    --art-fade: 100px;
    position: relative;
    display: flex;
    align-items: flex-end;
    overflow: hidden;
    margin-top: calc(-1 * var(--weeb-nav-height, 60px));
    background: var(--weeb-bg-elevated);
  }

  /* No opacity gate on a load event. The show page fades its banner in from a
     `chosen` event, but SafeImage only dispatches that on some of its paths --
     a cached priority image takes another one, and the banner then sat at
     opacity 0 with the full 1920px artwork loaded behind it. SafeImage already
     renders its own placeholder until an image resolves, so the gate was
     insurance against a state it handles itself. */
  .key-art__bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
  }

  .key-art__bg :global(.key-art__bg-img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center 25%;
  }

  .key-art__scrim-top {
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
     linear two-stop gradient begins fading at a constant slope and the eye
     reads that onset as a horizontal seam. */
  .key-art__scrim-bottom {
    position: absolute;
    inset: auto 0 0 0;
    height: var(--art-fade);
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

  /* The show page sets its text on panel glass; here the heading sits straight
     on the artwork, and key art is brightest exactly where a title needs to be
     readable. This darkens the lower half enough to hold white type without
     turning the picture into a backdrop -- the top third is untouched. */
  .key-art__scrim-text {
    position: absolute;
    inset: auto 0 0 0;
    height: 62%;
    z-index: 2;
    background: linear-gradient(
      to bottom,
      transparent 0%,
      color-mix(in oklch, var(--weeb-bg) 30%, transparent) 45%,
      color-mix(in oklch, var(--weeb-bg) 62%, transparent) 75%,
      color-mix(in oklch, var(--weeb-bg) 80%, transparent) 100%
    );
  }

  .key-art__stage {
    position: relative;
    z-index: 3;
    width: 100%;
    padding: 0 32px calc(24px + var(--art-fade)) 32px;
  }

  @media (max-width: 768px) {
    .key-art__stage {
      padding: 0 16px calc(16px + var(--art-fade)) 16px;
    }
  }
</style>
