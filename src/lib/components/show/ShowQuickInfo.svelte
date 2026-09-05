<script lang="ts">
  import AnimeActions from '$lib/components/tracking/AnimeActions.svelte';
  import AiringIndicator from '$lib/components/primitives/AiringIndicator.svelte';
  import Chip from '$lib/components/primitives/Chip.svelte';

  /**
   * The strip under the hero: the facts as chips on the left, the viewer's own
   * controls on the right. One cluster, not two -- at 2,526px `space-between`
   * pinned them to opposite ends with 1,539px of nothing between them.
   *
   * Presentational -- no bloc. Every write goes back out as a callback so the
   * page's one mutation owns them, which is what keeps the score and the
   * episode stepper from blanking each other's field.
   */
  let {
    anime,
    /** "Airing" or "Finished", with the dot coloured to match. */
    airingLabel,
    airing = false,
    studio = null,
    episodeCount = 0,
    /** The amber next-episode chip, or null when there is nothing scheduled. */
    nextChip = null,
    /** False when the show is not on the viewer's list: the controls are inert. */
    canTrack = false,
    pending = false,
    score = '' as number | '',
    watched = 0,
    total = null,
    onScore,
    onStep,
  }: {
    anime: any;
    airingLabel: string;
    airing?: boolean;
    studio?: string | null;
    episodeCount?: number;
    nextChip?: string | null;
    canTrack?: boolean;
    pending?: boolean;
    score?: number | '';
    watched?: number;
    total?: number | null;
    onScore: (value: string) => void;
    onStep: (delta: number) => void;
  } = $props();

  const SCORES = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
</script>

<div class="quick-info">
  <div class="quick-info__inner">
    <div class="quick-info__stats">
      {#if anime.ranking}
        <Chip tone="accent" mono leading={rankIcon} label="#{anime.ranking}" />
      {/if}
      <!-- Airing is green with the one pulse; anything else is a plain fact
           with a muted dot. It used to be a green chip and an AMBER "NOW" chip
           carrying a green dot, in a palette where amber already means
           "upcoming". -->
      {#if airing}
        <AiringIndicator state="airing" presentation="chip" label={airingLabel} />
      {:else}
        <Chip dot label={airingLabel} />
      {/if}
      {#if episodeCount > 0}
        <Chip mono label="{episodeCount} ep" />
      {/if}
      {#if anime.duration}
        <Chip label={anime.duration} />
      {/if}
      {#if studio}
        <Chip label={studio} />
      {/if}
      {#if anime.rating}
        <Chip label={anime.rating} />
      {/if}
      {#if nextChip === 'NOW'}
        <AiringIndicator state="airing" presentation="chip" label="NOW" mono />
      {:else if nextChip}
        <Chip tone="amber" mono label={nextChip} />
      {/if}
    </div>

    <div class="quick-info__tracking">
      <AnimeActions {anime} variant="default" />

      <select
        class="qi-select"
        aria-label="Your score"
        value={score}
        disabled={!canTrack || pending}
        onchange={(event) => onScore((event.currentTarget as HTMLSelectElement).value)}
      >
        <option value="">Score</option>
        {#each SCORES as value}
          <option {value}>{value}</option>
        {/each}
      </select>

      <div class="qi-progress">
        <button
          class="qi-ep-btn"
          type="button"
          aria-label="Decrease episodes watched"
          disabled={!canTrack || pending || watched <= 0}
          onclick={() => onStep(-1)}>&minus;</button
        >
        <span class="qi-ep-count">{watched}/{total ?? '?'}</span>
        <button
          class="qi-ep-btn"
          type="button"
          aria-label="Increase episodes watched"
          disabled={!canTrack || pending || (total !== null && watched >= total)}
          onclick={() => onStep(1)}>+</button
        >
      </div>
    </div>
  </div>
</div>

{#snippet rankIcon()}
  <svg class="qi-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"
    ><path d="M8 1l2.35 4.76 5.25.77-3.8 3.7.9 5.24L8 12.93l-4.7 2.54.9-5.24-3.8-3.7 5.25-.77z" /></svg
  >
{/snippet}

<style>
  .quick-info {
    width: 100%;
    padding: 0 var(--weeb-section-px);
    position: relative;
    z-index: 2;
    margin-top: -16px;
  }

  .quick-info__inner {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 24px;
    padding: 12px 20px;
    background: var(--weeb-bg-elevated);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius-lg);
    position: relative;
    z-index: 10;
  }

  .quick-info__stats {
    display: flex;
    align-items: center;
    gap: 8px;
    overflow-x: auto;
    -ms-overflow-style: none;
    scrollbar-width: none;
    flex: 0 1 auto;
    min-width: 0;
  }
  .quick-info__stats::-webkit-scrollbar {
    display: none;
  }

  /* The chips are `Chip`; the airing one is `AiringIndicator`. The only thing
     left here is the icon this row hands one of them. */
  .qi-icon {
    width: 12px;
    height: 12px;
    flex-shrink: 0;
  }

  .quick-info__tracking {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .qi-select {
    height: 32px;
    padding: 0 8px;
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius);
    background: var(--weeb-surface);
    color: var(--weeb-fg);
    font-family: var(--weeb-font-mono);
    font-size: 12px;
    font-weight: 600;
    outline: none;
    cursor: pointer;
    min-width: 60px;
    appearance: auto;
  }
  .qi-select:focus {
    border-color: var(--weeb-accent);
  }
  .qi-select:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .qi-progress {
    display: flex;
    align-items: center;
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius);
    overflow: hidden;
    height: 32px;
  }
  .qi-ep-btn {
    width: 28px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--weeb-surface);
    border: none;
    color: var(--weeb-fg-muted);
    font-size: 14px;
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
  }
  .qi-ep-btn:hover:not(:disabled) {
    background: var(--weeb-surface-hover);
    color: var(--weeb-fg);
  }
  .qi-ep-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  .qi-ep-count {
    padding: 0 8px;
    font-family: var(--weeb-font-mono);
    font-size: 12px;
    font-weight: 600;
    color: var(--weeb-fg);
    border-left: 1px solid var(--weeb-border);
    border-right: 1px solid var(--weeb-border);
    background: var(--weeb-surface);
    height: 32px;
    display: flex;
    align-items: center;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  /* No gutter override here. Both the bar and the tab bar read
     --weeb-section-px, and pinning this one to 16px put the content 8px left of
     the tab bar and the hero panel -- three left edges on one page. */
  @media (max-width: 768px) {
    .quick-info__inner {
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
      padding: 12px 14px;
    }
    .quick-info__tracking {
      flex-wrap: wrap;
      gap: 6px;
    }
  }

  @media (max-width: 480px) {
    .quick-info {
      margin-top: -8px;
    }
  }
</style>
