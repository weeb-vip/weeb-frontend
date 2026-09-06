<script lang="ts">
  import { bannerSourcesFor } from './KeyArtStage.logic';
  import type { Snippet } from 'svelte';
  import SafeImage from '$lib/components/primitives/SafeImage';
  import type { ChosenDetail } from '$lib/components/primitives/SafeImage/SafeImage.logic';

  /*
    The key-art backdrop: artwork as the ground, a scrim only under the nav, an
    optional scrim over the lower half for type sitting straight on the picture,
    and a fade band below the fold so the image dissolves into the page rather
    than ending on a hard cut.

    One backdrop, three call sites. The homepage banner, the show page's hero
    and the series page each drew this themselves -- three copies of the same
    two multi-stop gradients, the same SafeImage wiring and the same
    100svh-plus-fade box. Everything they genuinely differed on is a prop here:
    the fade band, the load fade, the crop, whether the page or this component
    pulls the stage up under the nav. What sits ON the stage is still each call
    site's own -- the homepage leads with a countdown badge, the show page with
    a poster and the identity panel, and neither is this component's business.

    Children can read `--art-fade`: it is the resolved height of the below-fold
    band, and anything bottom-anchored on the stage has to offset by it.
  */

  let {
    /** Anime id. Artwork is banners/<id>, with that anime's poster as fallback. */
    imageId = null,
    /**
     * Ordered artwork candidates, when the call site picks them itself -- the
     * homepage banner swaps the order on a phone, and the show page shares its
     * first candidate with the sticky header.
     */
    sources: explicitSources = null,
    /** Intended device-pixel width, for CDN resizing. Undefined = full-res. */
    cdnWidth = undefined,
    /**
     * Full viewport suits a page whose subject is the artwork. A page whose
     * subject is a list wants to show some of the list.
     */
    minHeight = '100svh',
    /**
     * The band below the fold carrying the dissolve into the page ground.
     * Nothing of it shows at rest. A caller whose page already owns the value
     * (the homepage sets it on the wrapper around banner, skeleton and rail)
     * passes that `var()` rather than a number.
     */
    fade = '100px',
    /** The same band at <=768px. Defaults to `fade`. */
    fadeMobile = null,
    /** The nav scrim's height at <=768px, where there is less room to spend. */
    scrimTopMobile = '180px',
    /**
     * `object-position` for the artwork. Key art is composed wide; a caller
     * cropping it into a tall box says which part to keep.
     */
    focus = 'center 50%',
    /**
     * False holds the artwork at opacity 0 so it fades in once something has
     * painted. Left true by a caller that wants no gate -- SafeImage only
     * dispatches `chosen` on some of its paths (a cached priority image takes
     * another one), and a gate on a page that cannot guarantee the event is how
     * a fully loaded banner ends up sitting at opacity 0 forever.
     */
    loaded = true,
    /** How long that fade takes. */
    fadeMs = 300,
    /**
     * The scrim over the lower half, for a stage whose type sits straight on
     * the artwork. A caller that puts its text on panel glass does not need it,
     * and darkening the picture for nothing is a cost.
     */
    textScrim = true,
    /** Pulls the stage up under the transparent nav. False when the page does. */
    underNav = true,
    /**
     * Clips to the stage box. False for a caller whose content spills a shadow
     * past the edge -- the homepage panel's does at narrow widths.
     */
    clip = true,
    /**
     * Wraps the children in the padded, bottom-anchored stage. False for a
     * caller that places its own content on the artwork.
     */
    stage = true,
    /** Names the stage as a region, when it is one. */
    ariaLabel = undefined,
    /** Fires once SafeImage has settled on a candidate -- failures included. */
    onChosen = undefined,
    /** What sits on the stage. Slotted content from a call site arrives here. */
    children,
  }: {
    imageId?: string | null;
    sources?: string[] | null;
    cdnWidth?: number;
    minHeight?: string;
    fade?: string;
    fadeMobile?: string | null;
    scrimTopMobile?: string;
    focus?: string;
    loaded?: boolean;
    fadeMs?: number;
    textScrim?: boolean;
    underNav?: boolean;
    clip?: boolean;
    stage?: boolean;
    ariaLabel?: string;
    onChosen?: (detail: ChosenDetail) => void;
    children?: Snippet;
  } = $props();

  // Both keyed by anime id: banners/<id> for the TheTVDB artwork synced by
  // thetvdb-enrichment, <id> at the root for the poster. Through
  // getSafeImageUrl so they follow config.cdn_url -- hardcoding the host meant
  // local and staging read production artwork, which hid staging having no
  // banners of its own.
  const artSources = $derived(explicitSources ?? bannerSourcesFor(imageId));

  // Two names for one number: the inline value, and the value at <=768px. An
  // inline custom property cannot be overridden by a media query, so the
  // breakpoint picks between these two and `--art-fade` is what the box is
  // actually built from.
  const vars = $derived(
    `--key-art-fade: ${fade}; --key-art-fade-sm: ${fadeMobile ?? fade};` +
      ` --key-art-scrim-top-sm: ${scrimTopMobile}; --key-art-focus: ${focus};` +
      ` --key-art-fade-ms: ${fadeMs}ms;`
  );
</script>

<section
  class="key-art"
  class:key-art--under-nav={underNav}
  class:key-art--clip={clip}
  aria-label={ariaLabel}
  style="min-height: calc({minHeight} + var(--art-fade)); {vars}"
>
  {#if artSources.length > 0}
    <div class="key-art__bg" style="opacity: {loaded ? 1 : 0};">
      <SafeImage
        sources={artSources}
        alt=""
        loading="eager"
        priority={true}
        fallbackSrc="/assets/not found.jpg"
        perTryTimeoutMs={3000}
        className="key-art__bg-img"
        {cdnWidth}
        {onChosen}
      />
    </div>
  {/if}

  <div class="key-art__scrim-top weeb-scrim-nav"></div>
  {#if textScrim}
    <div class="key-art__scrim-text"></div>
  {/if}
  <div class="key-art__scrim-bottom weeb-scrim-fade"></div>

  {#if stage}
    <div class="key-art__stage">
      {@render children?.()}
    </div>
  {:else}
    {@render children?.()}
  {/if}
</section>

<style>
  .key-art {
    --art-fade: var(--key-art-fade, 100px);
    --scrim-top: 180px;
    position: relative;
    display: flex;
    align-items: flex-end;
    background: var(--weeb-bg-elevated);
  }

  /* The stage runs up under the transparent nav. Off for a page that already
     pulls the whole banner block up itself. */
  .key-art--under-nav {
    margin-top: calc(-1 * var(--weeb-nav-height));
  }

  .key-art--clip {
    overflow: hidden;
  }

  .key-art__bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
    transition: opacity var(--key-art-fade-ms, 300ms);
  }

  /* :global because SafeImage renders the wrapper and the img itself. Both are
     sized: the wrapper carries the box, the img carries the crop. */
  .key-art__bg :global(.key-art__bg-img),
  .key-art__bg :global(.key-art__bg-img img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: var(--key-art-focus, center 50%);
    display: block;
  }

  /* Position and gradient are `.weeb-scrim-nav`; the height is this stage's,
     because it steps down on a phone where there is less room to spend. */
  .key-art__scrim-top {
    height: var(--scrim-top);
    z-index: 2;
  }

  /* Position and the smoothstep ramp are `.weeb-scrim-fade`; the height is the
     below-fold band, which the page owns and its children offset by. */
  .key-art__scrim-bottom {
    height: var(--art-fade);
    z-index: 2;
  }

  /* For a stage whose heading sits straight on the artwork, and key art is
     brightest exactly where a title needs to be readable. This darkens the
     lower half enough to hold white type without turning the picture into a
     backdrop -- the top third is untouched. */
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
    .key-art {
      --art-fade: var(--key-art-fade-sm, var(--key-art-fade, 100px));
      --scrim-top: var(--key-art-scrim-top-sm, 180px);
    }
    .key-art__stage {
      padding: 0 16px calc(16px + var(--art-fade)) 16px;
    }
  }
</style>
