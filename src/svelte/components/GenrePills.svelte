<script lang="ts">
  export let genres: string[] = [
    'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror',
    'Mecha', 'Music', 'Mystery', 'Psychological', 'Romance', 'Sci-Fi',
    'Slice of Life', 'Sports', 'Supernatural', 'Thriller'
  ];
</script>

<div class="genre-row">
  {#each genres as genre}
    <a class="genre-pill" href="/search?genre={encodeURIComponent(genre)}">{genre}</a>
  {/each}
</div>

<style>
  .genre-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .genre-pill {
    padding: 8px 16px;
    border-radius: 20px;
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    font-size: 13px;
    font-weight: 500;
    color: var(--weeb-fg-secondary);
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
    text-decoration: none;
  }
  .genre-pill:hover {
    border-color: var(--weeb-accent);
    color: var(--weeb-fg);
    background: var(--weeb-surface-hover);
  }
</style>
