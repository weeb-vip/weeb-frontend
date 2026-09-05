<script lang="ts">
  /**
   * Prev / page-info / Next, plus a per-page select. The markup was byte-for-byte
   * identical in ProfileAnimeList, ProfileWorkList and SearchPage, so this is a
   * straight lift of that shape rather than a redesign.
   *
   * `page` is zero-based, matching all three call sites; the label shown to a
   * reader is `page + 1`.
   *
   * Presentational -- no bloc. The owner of the query owns the page number.
   */
  let {
    page,
    totalPages,
    perPage,
    perPageOptions = [],
    onPageChange,
    onPerPageChange,
    label = 'Pagination',
  }: {
    /** Zero-based index of the current page. */
    page: number;
    totalPages: number;
    /** Omit (with `perPageOptions`) to render prev/next only. */
    perPage?: number;
    perPageOptions?: number[];
    onPageChange: (page: number) => void;
    onPerPageChange?: (perPage: number) => void;
    /** Accessible name for the nav landmark, when a page has more than one. */
    label?: string;
  } = $props();

  /**
   * Two paginators on one page would otherwise collide on the select's id, and
   * a label pointing at the wrong control is worse than no label.
   */
  const selectId = $props.id();

  const hasPrev = $derived(page > 0);
  const hasNext = $derived(page + 1 < totalPages);
  const showPerPage = $derived(perPage !== undefined && perPageOptions.length > 0);

  function handlePerPage(event: Event & { currentTarget: HTMLSelectElement }): void {
    const next = Number(event.currentTarget.value);
    if (!Number.isNaN(next)) onPerPageChange?.(next);
  }
</script>

<nav class="pg" aria-label={label}>
  <div class="pg-left">
    <button
      type="button"
      class="pg-btn"
      aria-label="Previous page"
      disabled={!hasPrev}
      onclick={() => onPageChange(page - 1)}
    >
      <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      <span class="pg-btn-label">Previous</span>
    </button>

    {#if totalPages > 1}
      <!-- Announced on change so a keyboard user paging with the buttons hears
           where they landed; the buttons themselves say nothing about position. -->
      <span class="pg-info" aria-live="polite">
        Page {(page + 1).toLocaleString()} of {totalPages.toLocaleString()}
      </span>
    {/if}

    <button
      type="button"
      class="pg-btn"
      aria-label="Next page"
      disabled={!hasNext}
      onclick={() => onPageChange(page + 1)}
    >
      <span class="pg-btn-label">Next</span>
      <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  </div>

  {#if showPerPage}
    <div class="pg-right">
      <label class="pg-per-label" for={selectId}>Show</label>
      <select id={selectId} class="pg-per-select" value={perPage} onchange={handlePerPage}>
        {#each perPageOptions as opt (opt)}
          <option value={opt}>{opt}</option>
        {/each}
      </select>
      <span class="pg-per-label">per page</span>
    </div>
  {/if}
</nav>

<style>
  .pg {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 24px;
    margin-top: 8px;
    flex-wrap: wrap;
    gap: 12px;
  }
  .pg-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .pg-right {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .pg-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    padding: 0 14px;
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius, 8px);
    color: var(--weeb-fg-secondary);
    font-family: var(--weeb-font);
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
  }
  .pg-btn:hover:not(:disabled) {
    border-color: var(--weeb-accent);
    color: var(--weeb-fg);
    background: var(--weeb-surface-hover);
  }
  .pg-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .pg-btn:focus-visible {
    outline: 2px solid var(--weeb-accent);
    outline-offset: 2px;
  }

  .pg-info {
    font-size: 0.8rem;
    color: var(--weeb-fg-muted);
    font-variant-numeric: tabular-nums;
    font-family: var(--weeb-font-mono, monospace);
  }

  .pg-per-label {
    font-size: 0.75rem;
    color: var(--weeb-fg-muted);
  }
  .pg-per-select {
    height: 32px;
    padding: 0 28px 0 10px;
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius, 8px);
    color: var(--weeb-fg);
    font-size: 0.8rem;
    font-family: var(--weeb-font-mono, monospace);
    font-variant-numeric: tabular-nums;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='%239ca3af' stroke-width='2' viewBox='0 0 24 24'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;
    transition: border-color 0.15s;
  }
  .pg-per-select:focus {
    outline: none;
    border-color: var(--weeb-accent);
  }
  .pg-per-select option {
    background: var(--weeb-surface);
    color: var(--weeb-fg);
  }

  /* Narrow: the row stacks and the button labels drop, leaving the two arrows
     either side of the page count -- still a legible control at 320px. */
  @media (max-width: 768px) {
    .pg { flex-direction: column; align-items: stretch; }
    .pg-left { justify-content: center; }
    .pg-right { justify-content: center; }
    .pg-btn-label { display: none; }
  }
</style>
