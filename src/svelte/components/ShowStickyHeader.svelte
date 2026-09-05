<script lang="ts">
  import AnimeActions from './AnimeActions.svelte';
  import SafeImage from './SafeImage.svelte';
  import { GetImageFromAnime, getYearUTC } from '../../services/utils';

  /**
   * The compact bar that takes over once the hero has scrolled away: cover,
   * name, one line of qualifiers, and the one action.
   *
   * Presentational -- no bloc. Whether it is showing, and what artwork sits
   * behind it, are the page's decisions.
   */
  let {
    anime,
    title,
    /** The blurred plate behind the bar. Usually the hero's first candidate. */
    background = '',
    visible = false,
    studio = null,
    airingLabel = '',
    height = $bindable(0),
  }: {
    anime: any;
    title: string;
    background?: string;
    visible?: boolean;
    studio?: string | null;
    airingLabel?: string;
    /** Measured back out, so the page can offset the tab bar under it. */
    height?: number;
  } = $props();

  /**
   * Moves the bar out to `<body>`.
   *
   * It is `position: fixed`, and a fixed element is positioned against the
   * nearest ancestor with a transform, filter or containment rather than the
   * viewport. The page below grows those (the hero's blur layers, view
   * transitions), so the only way to guarantee the bar stays pinned is for it
   * to have no ancestors at all.
   */
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        node.parentNode?.removeChild(node);
      },
    };
  }
</script>

<div
  use:portal
  data-sticky-header
  class="sticky-header"
  class:is-visible={visible}
  aria-hidden={!visible}
  bind:clientHeight={height}
>
  <div class="sticky-header__frame">
    <div class="sticky-header__plate" style="background-image: {background ? `url(${background})` : 'none'};"></div>
    <div class="sticky-header__wash"></div>

    <div class="sticky-header__inner">
      <SafeImage
        src={GetImageFromAnime(anime)}
        alt=""
        className="sticky-header__poster"
        fallbackSrc="/assets/not found.jpg"
        cdnWidth={80}
      />
      <div class="sticky-header__text">
        <!-- Not an h1: this repeats the title as navigation chrome. The page's
             h1 is the hero title, and having both made every show page emit two
             identical h1s. -->
        <p class="sticky-header__title">{title}</p>
        <p class="sticky-header__meta">
          {getYearUTC(anime?.startDate)} &bull; {airingLabel}{#if studio} &bull; {studio}{/if}
        </p>
      </div>
      <div class="sticky-header__actions">
        <AnimeActions {anime} variant="compact" />
      </div>
    </div>
  </div>
</div>

<style>
  .sticky-header {
    position: fixed;
    left: 0;
    right: 0;
    top: var(--weeb-nav-height, 60px);
    z-index: 90;
    transform: translateY(-100%);
    opacity: 0;
    pointer-events: none;
    transition: transform 0.3s ease, opacity 0.3s ease;
  }
  .sticky-header.is-visible {
    transform: translateY(0);
    opacity: 1;
    pointer-events: auto;
  }

  .sticky-header__frame {
    position: relative;
    overflow: hidden;
    border-bottom: 1px solid var(--weeb-border);
    box-shadow: var(--weeb-shadow-card);
  }

  /* The show's own artwork, blurred far enough to read as a tint rather than a
     picture -- it identifies the page without competing with the title on it. */
  .sticky-header__plate {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: center;
    filter: blur(12px) brightness(0.6);
    transform: scale(1.2);
  }
  .sticky-header__wash {
    position: absolute;
    inset: 0;
    backdrop-filter: blur(12px);
    background: color-mix(in oklch, var(--weeb-bg) 75%, transparent);
  }

  /* Full width with the section gutter, the same as the main content and the
     tab bar. This used to be a centred 1,536px column, which left the title and
     the action floating while everything below them ran edge to edge. */
  .sticky-header__inner {
    position: relative;
    z-index: 1;
    width: 100%;
    padding: 8px var(--weeb-section-px, 48px);
    display: flex;
    align-items: center;
    gap: 12px;
  }

  /* :global because SafeImage renders the img itself. */
  .sticky-header__inner :global(.sticky-header__poster) {
    width: 36px;
    height: 56px;
    object-fit: cover;
    border-radius: var(--weeb-radius-sm, 4px);
    flex-shrink: 0;
  }

  .sticky-header__text {
    min-width: 0;
    flex: 1;
  }
  .sticky-header__title {
    font-size: 16px;
    font-weight: 600;
    color: var(--weeb-fg);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sticky-header__meta {
    font-size: 12px;
    color: var(--weeb-fg-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sticky-header__actions {
    flex-shrink: 0;
  }
</style>
