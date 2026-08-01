<script lang="ts">
  import Seo from '$lib/Seo.svelte';
  import SafeImage from '../../../../svelte/components/SafeImage.svelte';
  import AnimeNews from '../../../../svelte/components/AnimeNews.svelte';
  import { GetImageFromAnime, getYearUTC } from '../../../../services/utils';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';

  export let data;

  /**
   * Banner candidates, same order as the show page: the tvdb artwork synced to the CDN
   * first, the poster as a fallback. Note GetImageFromAnime returns a CDN *slug*, not a
   * URL — SafeImage resolves it. Handing it anime.imageUrl (a MyAnimeList address) is
   * why the image was broken.
   */
  $: bannerSources = data.anime
    ? [
        `https://cdn.weeb.vip/weeb/banners/${encodeURIComponent(data.anime.id)}`,
        `https://cdn.weeb.vip/weeb/${encodeURIComponent(GetImageFromAnime(data.anime))}`
      ].filter(Boolean)
    : [];

  $: studio = Array.isArray(data.anime?.studios) ? data.anime.studios[0] : data.anime?.studios;

  /**
   * Filters are worth showing only once there's enough to filter. Below this a chip row
   * is decoration: with three stories you can read every headline faster than you can
   * decide which chip to press.
   */
  const MIN_ITEMS_FOR_FILTERS = 8;

  /**
   * Page size. Paging is a display cut, not a fetch: the gateway's `news` field takes no
   * arguments, so every story arrives in one response regardless. Real server-side paging
   * needs limit/offset on anime-api first.
   */
  const PAGE_SIZE = 10;

  $: news = data.news ?? [];

  // Counts come from the FULL set, not the filtered one — a chip reading "Staff 1" has to
  // keep saying 1 after you select it, or the numbers move as you click them.
  $: counts = news.reduce((acc: Record<string, number>, n: any) => {
    const c = (n?.category || '').toLowerCase();
    if (c) acc[c] = (acc[c] || 0) + 1;
    return acc;
  }, {});

  $: categories = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  $: showFilters = news.length >= MIN_ITEMS_FOR_FILTERS && categories.length >= 2;

  // Selection lives in the URL so a filtered view can be shared and survives a reload.
  $: selected = $page.url.searchParams.get('category');
  $: filtered = selected ? news.filter((n: any) => (n?.category || '').toLowerCase() === selected) : news;

  $: pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Clamped, so ?page=99 or a page that no longer exists after filtering lands on the
  // last real page instead of rendering an empty list.
  $: current = Math.min(Math.max(1, Number($page.url.searchParams.get('page')) || 1), pageCount);
  $: visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  $: firstShown = filtered.length === 0 ? 0 : (current - 1) * PAGE_SIZE + 1;
  $: lastShown = Math.min(current * PAGE_SIZE, filtered.length);

  function navigate(params: { category?: string | null; page?: number | null }) {
    const url = new URL($page.url);
    if ('category' in params) {
      if (params.category) url.searchParams.set('category', params.category);
      else url.searchParams.delete('category');
      // Changing the filter invalidates the page number — page 2 of "all" is rarely
      // page 2 of a category, and silently keeping it strands you on an empty view.
      url.searchParams.delete('page');
    }
    if ('page' in params) {
      if (params.page && params.page > 1) url.searchParams.set('page', String(params.page));
      else url.searchParams.delete('page');
    }
    goto(`${url.pathname}${url.search}`, { replaceState: true, noScroll: true, keepFocus: true });
  }

  const select = (category: string | null) => navigate({ category });
  const goPage = (n: number) => navigate({ page: n });

  const label = (c: string) => c.charAt(0).toUpperCase() + c.slice(1);
</script>

<Seo
  title={`${data.animeTitle} — News`}
  description={`All ${news.length} news ${news.length === 1 ? 'story' : 'stories'} for ${data.animeTitle}.`}
  image={data.animeImage}
/>

<div class="news-page">
  <a class="back" href={`/show/${data.animeId}`}>
    <svg viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 6H3" /><path d="M5.5 3.5L3 6l2.5 2.5" />
    </svg>
    Back to {data.animeTitle}
  </a>

  <!-- A scaled-down version of the show page's hero: enough to identify the anime when
       this URL is reached from a shared link, but deliberately smaller, with no actions
       or details grid, so it reads as a page ABOUT the news rather than the show page
       with news bolted on. -->
  <header class="hero">
    {#if bannerSources.length}
      <div class="hero-bg" aria-hidden="true">
        <SafeImage
          sources={bannerSources}
          alt=""
          loading="eager"
          fallbackSrc="/assets/not found.jpg"
          className="hero-bg-img"
        />
      </div>
    {/if}

    <div class="hero-inner">
      <div class="hero-poster">
        <SafeImage
          src={data.anime ? GetImageFromAnime(data.anime) : ''}
          alt={data.animeTitle}
          className="hero-poster-img"
          fallbackSrc="/assets/not found.jpg"
        />
      </div>

      <div class="hero-meta">
        <span class="kicker">
          News
          <span class="dot">·</span>
          {news.length} {news.length === 1 ? 'story' : 'stories'}
        </span>
        <h1>{data.animeTitle}</h1>
        {#if data.animeTitleJp}<span class="jp">{data.animeTitleJp}</span>{/if}
        <span class="sub">
          {#if getYearUTC(data.anime?.startDate)}{getYearUTC(data.anime.startDate)}{/if}
          {#if studio}<span class="dot">·</span>{studio}{/if}
        </span>
      </div>
    </div>
  </header>

  {#if data.ssrError}
    <p class="error">Couldn't load news right now. Try again in a moment.</p>
  {:else}
    {#if showFilters}
      <div class="filters" role="group" aria-label="Filter by category">
        <button class="chip" class:on={!selected} on:click={() => select(null)}>
          All <span class="n">{news.length}</span>
        </button>
        {#each categories as c (c)}
          <button
            class="chip cat"
            class:on={selected === c}
            style="--c: {`var(--cat-${c}, var(--weeb-fg-muted))`}"
            on:click={() => select(c)}
          >
            {label(c)} <span class="n">{counts[c]}</span>
          </button>
        {/each}
      </div>

    {/if}

    {#if filtered.length}
      <span class="resultline">
        Showing {firstShown}–{lastShown} of {filtered.length}{#if selected} · {label(selected)}{/if}
      </span>
    {/if}

    {#if selected && filtered.length === 0}
      <!-- Reachable from a shared link after the data changes, even though a zero-count
           chip is never rendered. -->
      <div class="empty">
        <strong>No {label(selected).toLowerCase()} stories</strong>
        <span>Nothing in this category yet for {data.animeTitle}.</span>
        <button class="reset" on:click={() => select(null)}>Show all {news.length}</button>
      </div>
    {:else}
      <!-- No limit prop: the page has already cut the list, and AnimeNews regroups by
           month over whatever it is handed, so each page gets its own headers. -->
      <AnimeNews news={visible} />

      {#if pageCount > 1}
        <nav class="pager" aria-label="News pages">
          <button class="pg nav" disabled={current === 1} on:click={() => goPage(current - 1)} aria-label="Previous page">←</button>
          {#each Array(pageCount) as _, i (i)}
            <button
              class="pg"
              class:on={current === i + 1}
              aria-current={current === i + 1 ? 'page' : undefined}
              on:click={() => goPage(i + 1)}
            >{i + 1}</button>
          {/each}
          <button class="pg nav" disabled={current === pageCount} on:click={() => goPage(current + 1)} aria-label="Next page">→</button>
        </nav>
      {/if}
    {/if}
  {/if}
</div>

<style>
  /* Category colours, kept in sync with AnimeNews. Declared here so the chips can look
     them up by name from the data rather than hardcoding a list of categories. */
  .news-page {
    --cat-announcement: var(--weeb-accent);
    --cat-release: var(--weeb-green);
    --cat-staff: var(--weeb-violet);
    --cat-reception: var(--weeb-amber);

    /* 1440px matches .main-content on the show page — a narrower column here made the
       page look like it belonged to a different site. */
    max-width: 1440px;
    margin: 0 auto;
    padding: calc(var(--weeb-nav-height, 60px) + 28px) var(--weeb-section-px, 48px) 72px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .back {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    align-self: flex-start;
    font-size: 13px;
    font-weight: 500;
    color: var(--weeb-fg-secondary);
    text-decoration: none;
    transition: color 140ms ease;
  }
  .back svg { width: 12px; height: 12px; transition: transform 140ms ease; }
  .back:hover { color: var(--weeb-fg); }
  .back:hover svg { transform: translateX(-2px); }
  .back:focus-visible {
    outline: 2px solid var(--weeb-accent-hover);
    outline-offset: 3px;
    border-radius: var(--weeb-radius-sm);
  }

  /* Compact hero. Same vocabulary as the show page — banner wash behind, poster left,
     meta right — at roughly half the height, so the news is what the page is for. */
  .hero {
    position: relative;
    overflow: hidden;
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius-lg);
    background: var(--weeb-bg-elevated);
  }
  .hero-bg { position: absolute; inset: 0; opacity: 0.28; }
  .hero-bg :global(.hero-bg-img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
    /* Blurred and dimmed so the title stays readable over any artwork. */
    filter: blur(18px) saturate(1.1);
    transform: scale(1.1);
  }
  /* Fade to the page background at the bottom edge so the hero doesn't end on a hard
     line against the list below. */
  .hero::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      100deg,
      color-mix(in oklch, var(--weeb-bg) 88%, transparent),
      color-mix(in oklch, var(--weeb-bg) 55%, transparent)
    );
  }

  .hero-inner {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 18px;
    padding: 18px 20px;
  }

  .hero-poster {
    width: 68px;
    flex: none;
    aspect-ratio: 2 / 3;
    border-radius: var(--weeb-radius);
    overflow: hidden;
    background: var(--weeb-surface);
    box-shadow: 0 6px 18px oklch(0% 0 0 / 0.35);
  }
  .hero-poster :global(.hero-poster-img) { width: 100%; height: 100%; object-fit: cover; }

  .hero-meta { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .kicker {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--weeb-font-mono);
    font-size: 10.5px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--weeb-accent-hover);
  }
  .hero-meta h1 {
    margin: 0;
    font-size: clamp(20px, 2.6vw, 26px);
    font-weight: 800;
    letter-spacing: -0.02em;
    text-wrap: balance;
  }
  .jp { font-size: 13px; color: var(--weeb-fg-secondary); }
  .sub {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--weeb-fg-muted);
  }
  .dot { color: var(--weeb-fg-muted); opacity: 0.6; }

  .filters { display: flex; flex-wrap: wrap; gap: 7px; }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font: inherit;
    font-size: 12.5px;
    font-weight: 500;
    padding: 5px 13px;
    border-radius: 20px;
    border: 1px solid var(--weeb-border);
    background: transparent;
    color: var(--weeb-fg-secondary);
    cursor: pointer;
    white-space: nowrap;
    transition: border-color 140ms ease, background 140ms ease, color 140ms ease;
  }
  .chip:hover { border-color: var(--weeb-surface-hover); color: var(--weeb-fg); }
  .chip:focus-visible { outline: 2px solid var(--weeb-accent-hover); outline-offset: 2px; }
  .chip .n {
    font-family: var(--weeb-font-mono);
    font-size: 10.5px;
    color: var(--weeb-fg-muted);
    font-variant-numeric: tabular-nums;
  }
  .chip.cat::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: var(--weeb-radius-full);
    background: var(--c);
    flex: none;
  }
  .chip.on {
    color: var(--weeb-fg);
    border-color: color-mix(in oklch, var(--weeb-accent) 60%, transparent);
    background: color-mix(in oklch, var(--weeb-accent) 16%, transparent);
  }
  .chip.cat.on {
    border-color: color-mix(in oklch, var(--c) 65%, transparent);
    background: color-mix(in oklch, var(--c) 15%, transparent);
  }

  .resultline {
    font-family: var(--weeb-font-mono);
    font-size: 12px;
    color: var(--weeb-fg-muted);
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 34px 16px;
    text-align: center;
    border: 1px dashed var(--weeb-border);
    border-radius: var(--weeb-radius);
  }
  .empty strong { font-size: 14px; font-weight: 600; }
  .empty span { font-size: 13px; color: var(--weeb-fg-muted); }
  .reset {
    font: inherit;
    font-size: 12.5px;
    color: var(--weeb-accent);
    background: transparent;
    border: 1px solid color-mix(in oklch, var(--weeb-accent) 45%, transparent);
    border-radius: 20px;
    padding: 5px 14px;
    margin-top: 3px;
    cursor: pointer;
  }
  .reset:hover { color: var(--weeb-accent-hover); }

  .error { margin: 0; font-size: 14px; color: var(--weeb-fg-secondary); }

  .pager {
    display: flex;
    align-items: center;
    gap: 5px;
    padding-top: 18px;
    margin-top: 4px;
    border-top: 1px solid var(--weeb-border);
  }
  .pg {
    font: inherit;
    font-family: var(--weeb-font-mono);
    font-size: 12px;
    min-width: 30px;
    padding: 5px 9px;
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius-sm);
    background: transparent;
    color: var(--weeb-fg-secondary);
    cursor: pointer;
    transition: border-color 140ms ease, background 140ms ease, color 140ms ease;
  }
  .pg:hover:not(:disabled) { color: var(--weeb-fg); border-color: var(--weeb-surface-hover); }
  .pg:focus-visible { outline: 2px solid var(--weeb-accent-hover); outline-offset: 2px; }
  .pg.on {
    color: var(--weeb-fg);
    border-color: color-mix(in oklch, var(--weeb-accent) 55%, transparent);
    background: color-mix(in oklch, var(--weeb-accent) 18%, transparent);
  }
  .pg:disabled { opacity: 0.4; cursor: default; }

  @media (max-width: 1024px) {
    .news-page { padding-left: 24px; padding-right: 24px; }
  }
  @media (max-width: 480px) {
    .news-page { padding-left: 16px; padding-right: 16px; }
    /* Chips scroll rather than wrap into a tall block that pushes the list off screen. */
    .filters { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 3px; }
    .chip { flex: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .back, .back svg, .chip { transition: none; }
  }
</style>
