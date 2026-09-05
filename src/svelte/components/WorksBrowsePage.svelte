<script lang="ts">
  import SectionHeader from './SectionHeader.svelte';
  import PosterGrid from './PosterGrid.svelte';
  import PosterCard from './PosterCard.svelte';
  import EmptyState from './EmptyState.svelte';
  import ErrorBanner from './ErrorBanner.svelte';
  import {
    WorksBrowsePageBloc,
    type WorkShelf,
    type WorkSummary,
  } from './WorksBrowsePage.bloc.svelte';

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
   *
   * A view over the bloc: which shelves have anything on them, how many cards
   * each holds at this breakpoint and where the pager points are its calls.
   */
  let {
    heading,
    blurb = '',
    basePath,
    /** Shelf mode: one entry per sort. Null in paged mode. */
    shelves = null,
    /** Paged mode. */
    works = [],
    sort = null,
    total = 0,
    page = 1,
    totalPages = 0,
    ssrError = null,
    /**
     * Defaults to a bloc reading this component's props, so the two route call
     * sites are unchanged and the server frame already has its shelves.
     */
    bloc = new WorksBrowsePageBloc({
      source: () => ({
        heading,
        blurb,
        basePath,
        shelves,
        works,
        sort,
        total,
        page,
        totalPages,
        ssrError,
      }),
    }),
  }: {
    heading: string;
    blurb?: string;
    basePath: string;
    shelves?: WorkShelf[] | null;
    works?: WorkSummary[];
    sort?: string | null;
    total?: number;
    page?: number;
    totalPages?: number;
    ssrError?: string | null;
    bloc?: WorksBrowsePageBloc;
  } = $props();
</script>

<!-- Standing in for a banner: the name of the shelf, one line on what is on
     it, and how much of it there is. No image -- a hero here would push the
     first row of covers below the fold, and the covers are what a reader came
     for. In the paged view the same block carries which shelf you opened, so
     it orients rather than repeating itself. -->
<header class="page-head">
  <h1>{bloc.heading}</h1>
  {#if bloc.blurb}<p class="blurb">{bloc.blurb}</p>{/if}
  {#if bloc.headMeta}<p class="head-meta">{bloc.headMeta}</p>{/if}
</header>

{#if bloc.mode === 'error'}
  <section class="section">
    <ErrorBanner message="Couldn’t load this page. Try again in a moment." />
  </section>
{:else if bloc.mode === 'paged'}
  <!-- Paged view: one shelf in full. -->
  <section class="section">
    <SectionHeader title={bloc.shelfTitle} href={bloc.basePath} linkText="← All shelves" />

    {#if bloc.pageWorks.length === 0}
      <EmptyState
        size="compact"
        heading="Nothing on this page"
        message="This page of the shelf is empty."
        action={{ label: '← All shelves', href: bloc.basePath, variant: 'ghost' }}
      />
    {:else}
      <PosterGrid>
        {#each bloc.pageWorks as work (work.id)}
          <PosterCard
            id={work.id ?? ''}
            title={work.titleEn || work.titleJp || ''}
            image={work.id ?? ''}
            imagePath="works"
            score={work.score}
            sub={bloc.subtitleFor(work)}
            href={bloc.hrefForWork(work)}
          />
        {/each}
      </PosterGrid>

      {#if bloc.totalPages > 1}
        <!-- Real links, not buttons: this pager is crawled, and a shelf page
             has to be reachable without JavaScript. That is why it is not the
             shared Pagination, which is callback-driven. -->
        <nav class="pager" aria-label="Pagination">
          {#if bloc.page > 1}
            <a class="page-link" href={bloc.hrefForPage(bloc.page - 1)} rel="prev">Previous</a>
          {/if}
          {#each bloc.pageWindow as p, i (p)}
            {#if i > 0 && p - bloc.pageWindow[i - 1] > 1}
              <span class="gap" aria-hidden="true">…</span>
            {/if}
            <a
              class="page-link"
              class:active={p === bloc.page}
              aria-current={p === bloc.page ? 'page' : undefined}
              href={bloc.hrefForPage(p)}>{p}</a
            >
          {/each}
          {#if bloc.page < bloc.totalPages}
            <a class="page-link" href={bloc.hrefForPage(bloc.page + 1)} rel="next">Next</a>
          {/if}
        </nav>
      {/if}
    {/if}
  </section>
{:else if bloc.mode === 'shelves'}
  <!-- Shelf view: the three sorts, each a section. -->
  {#each bloc.shelves as shelf (shelf.sort)}
    <section class="section">
      <SectionHeader
        title={shelf.label}
        href="{bloc.basePath}?sort={shelf.sort}"
        linkText="See all →"
      />
      <PosterGrid>
        {#each shelf.works as work (work.id)}
          <PosterCard
            id={work.id ?? ''}
            title={work.titleEn || work.titleJp || ''}
            image={work.id ?? ''}
            imagePath="works"
            score={work.score}
            sub={bloc.subtitleFor(work)}
            href={bloc.hrefForWork(work)}
          />
        {/each}
      </PosterGrid>
    </section>
  {/each}

  {#if bloc.shelvesAreEmpty}
    <section class="section">
      <EmptyState
        heading="Nothing here yet"
        message="The catalogue is still being filled in. Check back shortly."
        action={{ label: 'Browse anime', href: '/search', variant: 'ghost' }}
      />
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
