<script lang="ts">
  let {
    genres = [
      'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror',
      'Mecha', 'Music', 'Mystery', 'Psychological', 'Romance', 'Sci-Fi',
      'Slice of Life', 'Sports', 'Supernatural', 'Thriller'
    ],
  }: { genres?: string[] } = $props();
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
    gap: var(--weeb-pill-row-gap);
  }
  /* The link-flavoured pill: the same shape as Tabs' `pill` variant and
     FilterPills, off the same tokens, but an <a> to /search rather than a
     toggle. It used to hardcode `border-radius: 20px` -- written as though
     --weeb-radius-full meant 20px, which is the drift the tokens exist to stop.
     Kept at the touch height: this is the homepage's "Browse by Tag" row, a
     primary way into the catalogue rather than a dense filter strip. */
  .genre-pill {
    display: inline-flex;
    align-items: center;
    gap: var(--weeb-pill-gap);
    min-height: var(--weeb-pill-min-height-touch);
    padding: var(--weeb-pill-padding-y) var(--weeb-pill-padding-x);
    border-radius: var(--weeb-pill-radius);
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    font-size: var(--weeb-pill-font-size);
    font-weight: var(--weeb-pill-font-weight);
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
  .genre-pill:focus-visible {
    outline: 2px solid var(--weeb-accent);
    outline-offset: 2px;
  }
</style>
