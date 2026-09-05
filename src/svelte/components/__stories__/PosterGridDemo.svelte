<script lang="ts">
  /**
   * PosterGrid takes its cards as children, and a story's `args` cannot carry a
   * snippet with more than one root element. This renders the real grid with a
   * given number of stand-in tiles so the column behaviour is what is on show.
   */
  import PosterGrid from '../PosterGrid.svelte';

  let {
    minHeight = null,
    loading = false,
    class: className = '',
    count = 8,
  }: {
    minHeight?: string | null;
    loading?: boolean;
    class?: string;
    count?: number;
  } = $props();
</script>

<PosterGrid {minHeight} {loading} class={className}>
  {#each Array(count) as _, i}
    <div class="demo-card">
      <div class="demo-poster"></div>
      <div class="demo-title">Anime Title {i + 1}</div>
      <div class="demo-sub">TV &middot; 12 eps</div>
    </div>
  {/each}
</PosterGrid>

<style>
  .demo-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .demo-poster {
    aspect-ratio: 2 / 3;
    border-radius: var(--weeb-radius, 8px);
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
  }
  .demo-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--weeb-fg);
  }
  .demo-sub {
    font-size: 12px;
    color: var(--weeb-fg-muted);
  }
</style>
