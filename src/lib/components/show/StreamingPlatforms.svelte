<script lang="ts">
  import { StreamingPlatformsBloc } from './StreamingPlatforms.bloc.svelte';

  /** The rows the API gave us, or nothing when this show has no listings. */
  export type StreamingPlatform = { platform: string; name?: string | null; url: string };

  let {
    platforms = undefined,
    /**
     * Centre the logos on mobile. Only the anime page wants this -- its hero-meta
     * centres at 768px, so a left-aligned row would sit off-axis there. The
     * homepage banner keeps its text left-aligned at every width, so centring
     * the logos breaks that column instead of matching it.
     */
    centerOnMobile = false,
    /** Defaults to the real PostHog gate; stories inject a stub that just answers. */
    bloc = new StreamingPlatformsBloc(),
  }: {
    platforms?: StreamingPlatform[] | null;
    centerOnMobile?: boolean;
    bloc?: StreamingPlatformsBloc;
  } = $props();

  // The teardown comes straight back out of the bloc, so the interval never
  // outlives the component.
  $effect(() => bloc.watchFlag());
</script>

{#if bloc.enabled && platforms && platforms.length > 0}
  <div class="streaming-platforms">
    <span class="label">Watch on</span>
    <div class="platforms-list" class:center-mobile={centerOnMobile}>
      {#each platforms as platform}
        {@const name = platform.name || platform.platform}
        <a
          href={bloc.hrefFor(platform.url)}
          target="_blank"
          rel="noopener noreferrer"
          class="platform-link"
          data-tip={name}
          aria-label={`Watch on ${name}`}
        >
          <img
            src={bloc.iconFor(platform.platform)}
            alt=""
            class="platform-icon"
            loading="lazy"
          />
        </a>
      {/each}
    </div>
  </div>
{/if}

<style>
  .streaming-platforms {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin: 1rem 0;
    padding-top: 0.9rem;
    border-top: 1px solid var(--weeb-border);
  }

  /* Matches .hero-detail-key so it reads as a peer of the other hero labels. */
  .label {
    font-family: var(--weeb-font-mono);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--weeb-fg-muted);
  }

  .platforms-list {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem;
  }

  /* Bare logo; platform name shows in a popover on hover. */
  .platform-link {
    position: relative;
    display: inline-flex;
    text-decoration: none;
  }
  .platform-icon {
    width: 28px;
    height: 28px;
    object-fit: contain;
    display: block;
    transition: transform 0.12s ease;
  }
  .platform-link:hover .platform-icon,
  .platform-link:focus-visible .platform-icon {
    transform: scale(1.12);
  }

  /* Popover, styled on the weeb tokens. */
  .platform-link::after {
    content: attr(data-tip);
    position: absolute;
    bottom: calc(100% + 9px);
    left: 50%;
    transform: translateX(-50%) translateY(4px);
    padding: 0.3rem 0.5rem;
    border-radius: var(--weeb-radius-sm);
    background: var(--weeb-bg-elevated);
    border: 1px solid var(--weeb-border);
    color: var(--weeb-fg);
    font-size: 11px;
    font-weight: 600;
    line-height: 1;
    white-space: nowrap;
    box-shadow: var(--weeb-shadow-dropdown);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.14s ease, transform 0.14s ease;
    z-index: 30;
  }
  .platform-link::before {
    content: "";
    position: absolute;
    bottom: calc(100% + 4px);
    left: 50%;
    transform: translateX(-50%) translateY(4px);
    border: 5px solid transparent;
    border-top-color: var(--weeb-border);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.14s ease, transform 0.14s ease;
    z-index: 30;
  }
  .platform-link:hover::after,
  .platform-link:focus-visible::after,
  .platform-link:hover::before,
  .platform-link:focus-visible::before {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }

  @media (prefers-reduced-motion: reduce) {
    .platform-icon,
    .platform-link::after,
    .platform-link::before { transition: none; }
  }

  /* Enlarge the logos for touch on every surface. Centring is opt-in via
     `centerOnMobile` — the anime page hero centres its meta column at 768px,
     the homepage banner stays left-aligned. */
  @media (max-width: 768px) {
    .platforms-list { gap: 1.4rem; }
    .platforms-list.center-mobile { justify-content: center; }
    .platform-icon { width: 38px; height: 38px; }
  }
</style>
