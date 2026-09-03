<script lang="ts">
  import PosterCard from './PosterCard.svelte';
  import { workSubtitle } from '../../utils/workDisplay';
  import { WORK_SORTS } from '../../services/api/graphql/works';

  /**
   * The browse grid behind /manga and /light-novels.
   *
   * One component for both, parameterised by heading and the works it is
   * handed. The pages differ in copy and in the type they load; nothing about
   * the grid, the sort control or the pager is per-type.
   */

  export let heading: string;
  export let blurb: string = '';
  /** Where the sort and page links point -- '/manga' or '/light-novels'. */
  export let basePath: string;

  export let works: any[] = [];
  export let total: number = 0;
  export let page: number = 1;
  export let totalPages: number = 0;
  export let sort: string = 'POPULARITY';
  export let ssrError: string | null = null;

  // A work with no slug has no page to link to -- workBySlug is the only
  // lookup the schema exposes, so a card for one is a guaranteed 404. The
  // scraper is still filling these in, so this is a live condition rather
  // than a theoretical one.
  $: linkable = works.filter((w: any) => !!w?.urlSlug);
  $: hiddenCount = works.length - linkable.length;

  function href(nextPage: number, nextSort: string): string {
    const params = new URLSearchParams();
    if (nextPage > 1) params.set('page', String(nextPage));
    if (nextSort !== 'POPULARITY') params.set('sort', nextSort);
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  // A window around the current page rather than 2,219 links. First and last
  // are always reachable so the ends of the shelf are one click away.
  $: pageWindow = (() => {
    if (totalPages <= 1) return [] as number[];
    const span = 2;
    const pages = new Set<number>([1, totalPages]);
    for (let p = page - span; p <= page + span; p++) {
      if (p >= 1 && p <= totalPages) pages.add(p);
    }
    return [...pages].sort((a, b) => a - b);
  })();
</script>

<section class="works-browse">
  <header class="browse-header">
    <h1>{heading}</h1>
    {#if blurb}<p class="blurb">{blurb}</p>{/if}
    {#if total > 0}
      <p class="count">{total.toLocaleString()} titles</p>
    {/if}
  </header>

  {#if ssrError}
    <p class="browse-error" role="alert">Couldn’t load this page. Try again in a moment.</p>
  {:else if linkable.length === 0}
    <p class="browse-empty">Nothing here yet.</p>
  {:else}
    <nav class="sorts" aria-label="Sort">
      {#each WORK_SORTS as option}
        <a
          class="sort"
          class:active={option.value === sort}
          aria-current={option.value === sort ? 'true' : undefined}
          href={href(1, option.value)}
        >{option.label}</a>
      {/each}
    </nav>

    <div class="results-grid">
      {#each linkable as work (work.id)}
        <PosterCard
          id={work.id || ''}
          title={work.titleEn || work.titleJp || ''}
          image={work.id || ''}
          imagePath="works"
          score={work.score}
          sub={workSubtitle(work.type, work.publishedFrom)}
          description={work.synopsis || ''}
          href={`/manga/${work.urlSlug}`}
        />
      {/each}
    </div>

    {#if hiddenCount > 0}
      <!-- Said plainly rather than silently dropping them, so a short page
           does not look like a bug. -->
      <p class="hidden-note">{hiddenCount} more not yet ready to show.</p>
    {/if}

    {#if totalPages > 1}
      <nav class="pager" aria-label="Pagination">
        {#if page > 1}
          <a class="page-link" href={href(page - 1, sort)} rel="prev">Previous</a>
        {/if}
        {#each pageWindow as p, i}
          {#if i > 0 && p - pageWindow[i - 1] > 1}
            <span class="gap" aria-hidden="true">…</span>
          {/if}
          <a
            class="page-link"
            class:active={p === page}
            aria-current={p === page ? 'page' : undefined}
            href={href(p, sort)}
          >{p}</a>
        {/each}
        {#if page < totalPages}
          <a class="page-link" href={href(page + 1, sort)} rel="next">Next</a>
        {/if}
      </nav>
    {/if}
  {/if}
</section>

<style>
  .works-browse {
    max-width: 1400px;
    margin: 0 auto;
    padding: 1.5rem 1rem 3rem;
  }

  .browse-header h1 {
    margin: 0;
    font-size: 1.75rem;
    font-weight: 700;
  }

  .blurb {
    margin: 0.5rem 0 0;
    max-width: 60ch;
    opacity: 0.8;
  }

  .count {
    margin: 0.25rem 0 0;
    font-size: 0.875rem;
    opacity: 0.65;
  }

  .sorts {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 1.25rem 0;
  }

  .sort {
    padding: 0.35rem 0.75rem;
    border-radius: 999px;
    border: 1px solid currentColor;
    font-size: 0.875rem;
    text-decoration: none;
    opacity: 0.7;
  }

  .sort.active {
    opacity: 1;
    font-weight: 600;
  }

  .results-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 1rem;
  }

  .hidden-note,
  .browse-empty,
  .browse-error {
    margin-top: 1.5rem;
    font-size: 0.875rem;
    opacity: 0.7;
  }

  .pager {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    margin-top: 2rem;
  }

  .page-link {
    min-width: 2.25rem;
    padding: 0.4rem 0.6rem;
    border-radius: 0.375rem;
    border: 1px solid currentColor;
    text-align: center;
    text-decoration: none;
    font-size: 0.875rem;
    opacity: 0.7;
  }

  .page-link.active {
    opacity: 1;
    font-weight: 700;
  }

  .gap {
    padding: 0 0.15rem;
    opacity: 0.5;
  }
</style>
