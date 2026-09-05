<script lang="ts">
  import Skeleton from '$lib/components/primitives/Skeleton.svelte';

  /**
   * What the show page looks like before its data arrives.
   *
   * It used to draw the page that came BEFORE the ShowContent split: a centred
   * `bg-black/50 backdrop-blur` card floating over a 600px hero, a red status
   * pill, a left sidebar of "Titles / Production / Information" rows and a
   * tabbed panel of episode rows. None of that has existed since the page
   * became ShowHero + ShowQuickInfo + a stack of ShowSections, so the loading
   * state was a picture of a different page -- and the shape jumped the moment
   * the real one painted. It also ran an `animate-shimmer` keyframe with a
   * `via-white/40` sweep that nothing else in the app uses.
   *
   * This is the current stack, drawn from `Skeleton` like every other
   * placeholder: full-bleed hero with the identity panel bottom-left, the
   * quick-info bar overlapping its foot, the sticky section nav, then the
   * section column. `PosterCardSkeleton` is the model -- correct shape,
   * composed from the one primitive.
   *
   * Presentational -- no bloc.
   */

  /** The synopsis, news, episodes and characters sections, in that order. */
  const SECTIONS = [
    { heading: 'w-28', body: 'paragraph' as const },
    { heading: 'w-16', body: 'rows' as const },
    { heading: 'w-24', body: 'rows' as const },
    { heading: 'w-44', body: 'grid' as const },
  ];
</script>

<div class="skeleton-root" aria-busy="true" aria-label="Loading show">
  <!-- Hero: the artwork ground, its scrim, and the identity panel on it. -->
  <div class="skeleton-hero">
    <div class="skeleton-hero-art"></div>
    <div class="skeleton-hero-scrim"></div>
    <div class="skeleton-hero-stage">
      <div class="skeleton-panel">
        <div class="skeleton-identity">
          <Skeleton className="skeleton-poster bg-weeb-surface-hover" radius="md" />
          <div class="skeleton-identity-text">
            <Skeleton className="h-8 w-3/4 bg-weeb-surface-hover" radius="sm" />
            <Skeleton className="h-4 w-1/2 mt-3 bg-weeb-surface-hover" radius="sm" />
            <Skeleton className="h-3 w-24 mt-3 bg-weeb-surface-hover" radius="sm" />
          </div>
        </div>
        <div class="skeleton-panel-body">
          <Skeleton className="h-3 w-full bg-weeb-surface-hover" radius="sm" />
          <Skeleton className="h-3 w-full bg-weeb-surface-hover" radius="sm" />
          <Skeleton className="h-3 w-2/3 bg-weeb-surface-hover" radius="sm" />
        </div>
      </div>
    </div>
  </div>

  <!-- Quick info: the chip row and the tracking controls, overlapping the hero. -->
  <div class="skeleton-quick-info">
    <div class="skeleton-quick-info-inner">
      <div class="skeleton-chips">
        {#each ['w-16', 'w-20', 'w-14', 'w-24', 'w-16'] as width}
          <Skeleton className="h-8 {width} bg-weeb-surface-hover" radius="full" />
        {/each}
      </div>
      <div class="skeleton-controls">
        <Skeleton className="h-8 w-28 bg-weeb-surface-hover" radius="md" />
        <Skeleton className="h-8 w-16 bg-weeb-surface-hover" radius="md" />
        <Skeleton className="h-8 w-24 bg-weeb-surface-hover" radius="md" />
      </div>
    </div>
  </div>

  <!-- The sticky section nav. -->
  <div class="skeleton-nav">
    <div class="skeleton-nav-inner">
      {#each ['w-20', 'w-14', 'w-20', 'w-32', 'w-24'] as width}
        <Skeleton className="h-4 {width}" radius="sm" />
      {/each}
    </div>
  </div>

  <!-- The section column: a ruled heading over each block. -->
  <div class="skeleton-main">
    {#each SECTIONS as section}
      <section class="skeleton-section">
        <div class="skeleton-heading">
          <Skeleton className="h-5 {section.heading}" radius="sm" />
          <span class="skeleton-rule"></span>
        </div>

        {#if section.body === 'paragraph'}
          <div class="skeleton-stack">
            <Skeleton className="h-3.5 w-full" radius="sm" />
            <Skeleton className="h-3.5 w-full" radius="sm" />
            <Skeleton className="h-3.5 w-11/12" radius="sm" />
            <Skeleton className="h-3.5 w-2/3" radius="sm" />
          </div>
        {:else if section.body === 'rows'}
          <div class="skeleton-stack">
            {#each Array(3) as _}
              <div class="skeleton-row">
                <Skeleton className="h-10 w-10 bg-weeb-surface-hover" radius="md" />
                <div class="skeleton-row-text">
                  <Skeleton className="h-3.5 w-2/5 bg-weeb-surface-hover" radius="sm" />
                  <Skeleton className="h-3 w-3/5 mt-2 bg-weeb-surface-hover" radius="sm" />
                </div>
                <Skeleton className="h-3 w-16 bg-weeb-surface-hover" radius="sm" />
              </div>
            {/each}
          </div>
        {:else}
          <div class="skeleton-grid">
            {#each Array(6) as _}
              <div class="skeleton-row">
                <Skeleton className="h-12 w-12 bg-weeb-surface-hover" radius="md" />
                <div class="skeleton-row-text">
                  <Skeleton className="h-3.5 w-3/5 bg-weeb-surface-hover" radius="sm" />
                  <Skeleton className="h-3 w-2/5 mt-2 bg-weeb-surface-hover" radius="sm" />
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </section>
    {/each}
  </div>
</div>

<style>
  .skeleton-root {
    min-height: 100vh;
    background: var(--weeb-bg);
    position: relative;
  }

  /* The hero is full-bleed and runs under the nav, exactly as ShowHero does. */
  .skeleton-hero {
    --hero-fade: 100px;
    position: relative;
    min-height: calc(100svh + var(--hero-fade));
    display: flex;
    align-items: flex-end;
    overflow: hidden;
    margin-top: calc(-1 * var(--weeb-nav-height));
    background: var(--weeb-bg-elevated);
  }
  /* Stands in for the key art. Elevated rather than surface, so the panel
     glass over it -- which is surface at 90% -- still reads as a panel. */
  .skeleton-hero-art {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      160deg,
      var(--weeb-surface) 0%,
      var(--weeb-bg-elevated) 55%,
      var(--weeb-bg) 100%
    );
  }
  .skeleton-hero-scrim {
    position: absolute;
    inset: auto 0 0 0;
    height: var(--hero-fade);
    z-index: 2;
    background: linear-gradient(to bottom, transparent 0%, var(--weeb-bg) 100%);
  }
  .skeleton-hero-stage {
    position: relative;
    z-index: 3;
    width: 100%;
    padding: 0 32px calc(32px + var(--hero-fade)) 32px;
  }

  /* The identity panel: panel glass, not a black card floating mid-page. */
  .skeleton-panel {
    max-width: min(560px, calc(100vw - 460px));
    background: var(--weeb-panel-bg);
    backdrop-filter: var(--weeb-panel-blur);
    -webkit-backdrop-filter: var(--weeb-panel-blur);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius-lg);
    box-shadow: var(--weeb-shadow-card);
    padding: 20px;
  }
  .skeleton-identity {
    display: flex;
    gap: 20px;
  }
  .skeleton-identity-text {
    flex: 1;
    min-width: 0;
    padding-top: 4px;
  }
  .skeleton-panel :global(.skeleton-poster) {
    flex: 0 0 auto;
    width: 150px;
    aspect-ratio: 2 / 3;
  }
  .skeleton-panel-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 20px;
  }

  .skeleton-quick-info {
    width: 100%;
    padding: 0 var(--weeb-section-px);
    position: relative;
    z-index: 2;
    margin-top: -16px;
  }
  .skeleton-quick-info-inner {
    display: flex;
    align-items: center;
    gap: 24px;
    padding: 12px 20px;
    background: var(--weeb-bg-elevated);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius-lg);
  }
  .skeleton-chips,
  .skeleton-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
  .skeleton-chips {
    flex: 0 1 auto;
    overflow: hidden;
  }

  .skeleton-nav {
    margin-top: 24px;
    border-bottom: 1px solid var(--weeb-border);
  }
  .skeleton-nav-inner {
    width: 100%;
    padding: 0 var(--weeb-section-px);
    display: flex;
    align-items: center;
    gap: 24px;
    height: 48px;
  }

  .skeleton-main {
    width: 100%;
    padding: var(--weeb-section-py) var(--weeb-section-px) 20px;
    display: flex;
    flex-direction: column;
    gap: var(--weeb-section-py);
  }

  /* Matches ShowSection: the heading, then the hairline out to the column edge. */
  .skeleton-heading {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
  }
  .skeleton-rule {
    flex: 1;
    height: 1px;
    background: var(--weeb-border);
  }

  .skeleton-stack {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  /* The card ground the rows load into is --weeb-surface; the blocks inside
     these are surface-hover, one step up, so the placeholder reads as content
     in a card rather than as an empty card. */
  .skeleton-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px;
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius);
    background: var(--weeb-surface);
  }
  .skeleton-row-text {
    flex: 1;
    min-width: 0;
  }
  .skeleton-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
    gap: 12px;
  }

  @media (max-width: 1024px) {
    .skeleton-hero-stage {
      padding: 0 12px calc(16px + var(--hero-fade)) 12px;
    }
    .skeleton-panel {
      max-width: none;
      padding: 14px;
    }
    .skeleton-panel :global(.skeleton-poster) {
      width: clamp(96px, 12vw, 148px);
    }
  }

  @media (max-width: 768px) {
    .skeleton-hero {
      --hero-fade: 70px;
    }
    .skeleton-quick-info-inner {
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
      padding: 12px 14px;
    }
    .skeleton-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
