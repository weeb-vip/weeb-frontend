<script lang="ts">
  import { formatDateUTC } from '../../services/utils';
  import { allStudios } from './ShowContent.rules';

  /**
   * The reference block: everything about the record that is not the story.
   *
   * Presentational -- no bloc. Rows that have no value are absent rather than
   * blank, because "Licensors: --" asserts we looked and there were none.
   */
  let { anime }: { anime: any } = $props();

  const studios = $derived(allStudios(anime?.studios));
  const licensors = $derived(
    Array.isArray(anime?.licensors) ? anime.licensors.join(', ') : (anime?.licensors ?? null),
  );
</script>

<div class="info-grid">
  {#if anime.titleJp}
    <div class="info-item">
      <span class="info-label">Japanese</span>
      <span class="info-value" lang="ja">{anime.titleJp}</span>
    </div>
  {/if}
  {#if anime.titleRomaji}
    <div class="info-item">
      <span class="info-label">Romaji</span>
      <span class="info-value">{anime.titleRomaji}</span>
    </div>
  {/if}
  {#if studios}
    <div class="info-item">
      <span class="info-label">Studios</span>
      <span class="info-value">{studios}</span>
    </div>
  {/if}
  {#if anime.source}
    <div class="info-item">
      <span class="info-label">Source</span>
      <!-- The value stays the category MyAnimeList records -- "Light novel",
           "Manga" -- and becomes a link to the actual work once we know which
           one. Which is the point of modelling works at all: the category told
           you what kind of thing it came from, never which one. -->
      {#if anime.sourceWork?.urlSlug}
        <a
          class="info-value info-value--link"
          href="/manga/{anime.sourceWork.urlSlug}"
          title={anime.sourceWork.titleEn || anime.sourceWork.titleJp || undefined}
          >{anime.source}</a
        >
      {:else}
        <span class="info-value">{anime.source}</span>
      {/if}
    </div>
  {/if}
  {#if licensors}
    <div class="info-item">
      <span class="info-label">Licensors</span>
      <span class="info-value">{licensors}</span>
    </div>
  {/if}
  {#if anime.rating}
    <div class="info-item">
      <span class="info-label">Rating</span>
      <span class="info-value">{anime.rating}</span>
    </div>
  {/if}
  {#if anime.broadcast}
    <div class="info-item">
      <span class="info-label">Broadcast</span>
      <span class="info-value">{anime.broadcast}</span>
    </div>
  {/if}
  <div class="info-item">
    <span class="info-label">Aired</span>
    <span class="info-value"
      >{formatDateUTC(anime.startDate, 'Unknown')} &ndash; {formatDateUTC(anime.endDate, 'Ongoing')}</span
    >
  </div>
  {#if anime.titleSynonyms && anime.titleSynonyms.length > 0}
    <div class="info-item info-item--full">
      <span class="info-label">Synonyms</span>
      <span class="info-value">{anime.titleSynonyms.join(', ')}</span>
    </div>
  {/if}
</div>

<style>
  /* An explicit column count, not auto-fill. These are fixed rows of reference
     data whose length is known, so auto-fill's answer at 2,526px was nine
     columns -- one 48px-tall strip with two empty bordered cells -- rather than
     a shape anyone chose. Bounded for the same reason: it stops growing instead
     of stretching.

     Dividers are per-cell borders on the leading edges, pulled back over the
     preceding cell by a matching negative margin. Three properties fall out of
     that and all three matter: the borders never occupy layout space, the first
     row's and column's borders land outside the padding box and are clipped by
     overflow:hidden so the container's own frame is not doubled, and a cell that
     does not exist draws nothing -- so a partial final row is simply the
     container's background rather than a lighter block. */
  .info-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    max-width: 1200px;
    background: var(--weeb-bg-elevated);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius-lg);
    overflow: hidden;
  }
  @media (min-width: 640px) {
    .info-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (min-width: 1024px) {
    .info-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  .info-item {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 16px;
    padding: 14px 20px;
    background: var(--weeb-bg-elevated);
    border-left: 1px solid var(--weeb-border);
    border-top: 1px solid var(--weeb-border);
    margin: -1px 0 0 -1px;
  }
  .info-item--full {
    grid-column: 1 / -1;
  }

  .info-label {
    font-family: var(--weeb-font-mono);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: var(--weeb-fg-muted);
    text-transform: uppercase;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .info-value {
    font-size: 13px;
    color: var(--weeb-fg-secondary);
    text-align: right;
    line-height: 1.4;
  }
  /* Underlined at rest. This value sits in a grid of plain values, so colour
     alone would not tell a reader that this one row goes somewhere. */
  .info-value--link {
    color: var(--weeb-accent-text);
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-decoration-color: color-mix(in oklch, var(--weeb-accent-text) 45%, transparent);
    text-underline-offset: 3px;
    transition: text-decoration-color 0.15s ease, color 0.15s ease;
  }
  .info-value--link:hover,
  .info-value--link:focus-visible {
    color: var(--weeb-fg);
    text-decoration-color: currentColor;
  }
</style>
