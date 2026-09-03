<script lang="ts">
  import SectionHeader from './SectionHeader.svelte';
  import PosterGrid from './PosterGrid.svelte';
  import PosterCard from './PosterCard.svelte';
  import { isPhone, isTablet } from '../stores/viewport';
  import { workSubtitle } from '../../utils/workDisplay';
  import { shelfLabel } from '../../services/api/graphql/works';

  /**
   * The shelves behind /manga and /light-novels.
   *
   * One component for both, parameterised by heading and the works it is
   * handed. The pages differ in copy and in the type they load; nothing about
   * the shelves, the grid or the pager is per-type.
   *
   * Laid out as the homepage lays out its shelves -- full-bleed sections
   * separated by a rule, SectionHeader over PosterGrid -- so a reader who
   * arrives from the homepage is on the same page they were already reading.
   * The alternative was a centred column with its own grid, which is how the
   * poster grid came to disagree with itself on four pages before PosterGrid
   * existed.
   */

  export let heading: string;
  export let blurb: string = '';
  export let basePath: string;

  /** Shelf mode: one entry per sort. Null in paged mode. */
  export let shelves: { sort: string; label: string; works: any[] }[] | null = null;
  /** Paged mode. */
  export let works: any[] = [];
  export let sort: string | null = null;
  export let total: number = 0;
  export let page: number = 1;
  export let totalPages: number = 0;
  export let ssrError: string | null = null;

  // Matches the homepage exactly, so a shelf holds the same number of cards
  // wherever it appears.
  $: shelfLimit = $isPhone ? 6 : $isTablet ? 12 : 20;

  // A work with no slug has no page to link to -- workBySlug is the only
  // lookup the schema exposes, so a card for one is a guaranteed 404. The
  // scraper is still filling these in, so this is live rather than theoretical.
  const linkable = (list: any[]) => list.filter((w: any) => !!w?.urlSlug);

  function pageHref(nextPage: number): string {
    const params = new URLSearchParams();
    if (sort) params.set('sort', sort);
    if (nextPage > 1) params.set('page', String(nextPage));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  // A window around the current page rather than 2,219 links. First and last
  // stay reachable so the ends of the shelf are one click away.
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

<!-- Standing in for a banner: the name of the shelf, one line on what is on
     it, and how much of it there is. No image -- a hero here would push the
     first row of covers below the fold, and the covers are what a reader came
     for. In the paged view the same block carries which shelf you opened, so
     it orients rather than repeating itself. -->
<header class="page-head">
  <h1>{heading}</h1>
  {#if blurb}<p class="blurb">{blurb}</p>{/if}
  {#if total > 0}
    <p class="head-meta">
      {total.toLocaleString()} titles{#if sort}{' · '}{shelfLabel(sort)}, page {page} of {totalPages.toLocaleString()}{/if}
    </p>
  {/if}
</header>

{#if ssrError}
  <section class="section">
    <p class="notice" role="alert">Couldn’t load this page. Try again in a moment.</p>
  </section>
{:else if sort}
  <!-- Paged view: one shelf in full. -->
  <section class="section">
    <SectionHeader title={shelfLabel(sort)} href={basePath} linkText="← All shelves" />

    {#if linkable(works).length === 0}
      <p class="notice">Nothing on this page.</p>
    {:else}
      <PosterGrid>
        {#each linkable(works) as work (work.id)}
          <PosterCard
            id={work.id}
            title={work.titleEn || work.titleJp || ''}
            image={work.id}
            imagePath="works"
            score={work.score}
            sub={workSubtitle(work.type, work.publishedFrom)}
            href={`/manga/${work.urlSlug}`}
          />
        {/each}
      </PosterGrid>

      {#if totalPages > 1}
        <nav class="pager" aria-label="Pagination">
          {#if page > 1}
            <a class="page-link" href={pageHref(page - 1)} rel="prev">Previous</a>
          {/if}
          {#each pageWindow as p, i}
            {#if i > 0 && p - pageWindow[i - 1] > 1}
              <span class="gap" aria-hidden="true">…</span>
            {/if}
            <a
              class="page-link"
              class:active={p === page}
              aria-current={p === page ? 'page' : undefined}
              href={pageHref(p)}
            >{p}</a>
          {/each}
          {#if page < totalPages}
            <a class="page-link" href={pageHref(page + 1)} rel="next">Next</a>
          {/if}
        </nav>
      {/if}
    {/if}
  </section>
{:else if shelves}
  <!-- Shelf view: the three sorts, each a section. -->
  {#each shelves as shelf (shelf.sort)}
    {@const items = linkable(shelf.works).slice(0, shelfLimit)}
    {#if items.length > 0}
      <section class="section">
        <SectionHeader
          title={shelf.label}
          href="{basePath}?sort={shelf.sort}"
          linkText="See all →"
        />
        <PosterGrid>
          {#each items as work (work.id)}
            <PosterCard
              id={work.id}
              title={work.titleEn || work.titleJp || ''}
              image={work.id}
              imagePath="works"
              score={work.score}
              sub={workSubtitle(work.type, work.publishedFrom)}
              href={`/manga/${work.urlSlug}`}
            />
          {/each}
        </PosterGrid>
      </section>
    {/if}
  {/each}

  {#if shelves.every((s) => linkable(s.works).length === 0)}
    <section class="section">
      <p class="notice">Nothing here yet.</p>
    </section>
  {/if}
{/if}

<style>
  /* Full-bleed, matching the homepage's sections: the shelves are the page,
     and a max-width column would strand cards on the wide displays this
     catalogue is most often browsed on. The rule between sections is what
     separates one shelf from the next -- no card, no box. */
  .section {
    padding: 48px var(--weeb-section-px, 48px);
  }

  .section + .section {
    border-top: 1px solid var(--weeb-border, oklch(28% 0.015 275));
  }

  /* Sits on the page's own background rather than in a card, and carries the
     same horizontal padding as the shelves so the h1 lines up with the first
     cover beneath it. The rule is the section rhythm starting here rather than
     a border drawn around the block. */
  .page-head {
    padding: 40px var(--weeb-section-px, 48px) 28px;
    border-bottom: 1px solid var(--weeb-border, oklch(28% 0.015 275));
  }

  .page-head h1 {
    margin: 0;
    font-size: clamp(28px, 4vw, 44px);
    font-weight: 800;
    line-height: 1.1;
    letter-spacing: -0.02em;
    color: var(--weeb-fg, oklch(95% 0.005 265));
  }

  .blurb {
    margin: 10px 0 0;
    max-width: 62ch;
    color: var(--weeb-fg-secondary, oklch(70% 0.01 270));
    font-size: 15px;
    line-height: 1.6;
  }

  .head-meta {
    margin: 12px 0 0;
    color: var(--weeb-fg-muted, oklch(62% 0.01 270));
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }

  .notice {
    margin: 0;
    color: var(--weeb-fg-muted, oklch(62% 0.01 270));
    font-size: 14px;
  }

  .pager {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-top: 32px;
  }

  .page-link {
    min-width: 40px;
    padding: 8px 12px;
    border: 1px solid var(--weeb-border, oklch(28% 0.015 275));
    border-radius: 8px;
    color: var(--weeb-fg-secondary, oklch(70% 0.01 270));
    font-size: 14px;
    text-align: center;
    text-decoration: none;
    transition: color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
  }

  .page-link:hover {
    background: var(--weeb-surface-hover, oklch(26% 0.022 275));
    border-color: var(--weeb-accent, oklch(55% 0.16 298));
    color: var(--weeb-fg, oklch(95% 0.005 265));
  }

  .page-link.active {
    background: var(--weeb-accent, oklch(55% 0.16 298));
    border-color: var(--weeb-accent, oklch(55% 0.16 298));
    color: var(--weeb-fg, oklch(95% 0.005 265));
    font-weight: 600;
  }

  .gap {
    padding: 0 2px;
    color: var(--weeb-fg-muted, oklch(62% 0.01 270));
  }

  @media (max-width: 767px) {
    .section {
      padding: var(--weeb-section-py, 32px) var(--weeb-section-px, 24px);
    }
    .page-head {
      padding: 28px var(--weeb-section-px, 24px) 20px;
    }
  }

  @media (max-width: 400px) {
    .section {
      padding: var(--weeb-section-py, 24px) var(--weeb-section-px, 16px);
    }
    .page-head {
      padding: 24px var(--weeb-section-px, 16px) 18px;
    }
  }
</style>
