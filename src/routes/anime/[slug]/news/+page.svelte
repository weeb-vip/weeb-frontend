<script lang="ts">
  import Seo from '$lib/Seo.svelte';
  import StructuredData from '$lib/StructuredData.svelte';
  import { breadcrumbSchema } from '$lib/structured-data';
  import { untrack } from 'svelte';
  import SafeImage from '../../../../svelte/components/SafeImage.svelte';
  import AnimeNews from '../../../../svelte/components/AnimeNews.svelte';
  import { AnimeNewsPageBloc, type AnimeNewsPageData } from '../../../../svelte/components/AnimeNewsPage.bloc.svelte';

  /**
   * Every news story for one anime, filtered by category and paged, both of
   * which live in the URL.
   */
  let {
    data,
    bloc: injected = undefined,
  }: {
    /** `animeImage` is the loader's, for the social card -- the page never draws it. */
    data: AnimeNewsPageData & { animeImage?: string };
    bloc?: AnimeNewsPageBloc;
  } = $props();

  const bloc = untrack(() => injected) ?? new AnimeNewsPageBloc();

  // Bound in the init body rather than an $effect: effects do not run during
  // SSR, and this page is server-rendered down to the chips. The closure keeps
  // the bloc on the live prop when you navigate from one show's news to
  // another's without unmounting.
  bloc.bindData(() => data);

  // The flag poll's teardown comes straight back out of the bloc.
  $effect(() => bloc.watchFlag());

  const SITE_URL = 'https://weeb.vip';

  const total = $derived((data.news ?? []).length);
  // Trailing "." on a title would otherwise produce "…Last Stand.." in the description.
  const descTitle = $derived(data.animeTitle.replace(/\.+$/, ''));
  const breadcrumbs = $derived(
    breadcrumbSchema([
      { name: 'Home', url: `${SITE_URL}/` },
      { name: data.animeTitle, url: `${SITE_URL}/anime/${data.animeSlug}` },
      { name: 'News', url: `${SITE_URL}/anime/${data.animeSlug}/news` }
    ])
  );
</script>

<Seo
  title={`${data.animeTitle} — News`}
  description={`All ${total} news ${total === 1 ? 'story' : 'stories'} for ${descTitle}.`}
  image={data.animeImage}
/>

<StructuredData schemas={[breadcrumbs]} />

<div class="news-page">
  <a class="back" href={bloc.backHref}>
    <svg viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 6H3" /><path d="M5.5 3.5L3 6l2.5 2.5" />
    </svg>
    Back to {bloc.title}
  </a>

  <!-- A scaled-down version of the show page's hero: enough to identify the anime when
       this URL is reached from a shared link, but deliberately smaller, with no actions
       or details grid, so it reads as a page ABOUT the news rather than the show page
       with news bolted on. -->
  <header class="hero">
    {#if bloc.bannerSources.length}
      <div class="hero-bg" aria-hidden="true">
        <SafeImage
          sources={bloc.bannerSources}
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
          src={bloc.posterSource}
          alt={bloc.title}
          className="hero-poster-img"
          fallbackSrc="/assets/not found.jpg"
        />
      </div>

      <div class="hero-meta">
        <span class="kicker">
          News
          <span class="dot">·</span>
          {bloc.storyCount}
        </span>
        <h1>{bloc.title}</h1>
        {#if bloc.titleJp}<span class="jp" lang="ja">{bloc.titleJp}</span>{/if}
        <span class="sub">
          {bloc.year}
          {#if bloc.studio}<span class="dot">·</span>{bloc.studio}{/if}
        </span>
      </div>
    </div>
  </header>

  {#if !bloc.newsEnabled}
    <!-- Nothing while flags resolve, then a plain message. The hero above stays either
         way, so a direct link still tells you which anime you asked about. -->
    {#if bloc.flagsResolved}
      <p class="error">News isn't available yet.</p>
    {/if}
  {:else if bloc.hasError}
    <p class="error">Couldn't load news right now. Try again in a moment.</p>
  {:else}
    {#if bloc.showFilters}
      <div class="filters" role="group" aria-label="Filter by category">
        <button class="chip" class:on={!bloc.selected} onclick={() => bloc.selectCategory(null)}>
          All <span class="n">{bloc.total}</span>
        </button>
        {#each bloc.categories as c (c)}
          <button
            class="chip cat"
            class:on={bloc.selected === c}
            style="--c: {`var(--cat-${c}, var(--weeb-fg-muted))`}"
            onclick={() => bloc.selectCategory(c)}
          >
            {bloc.label(c)} <span class="n">{bloc.counts[c]}</span>
          </button>
        {/each}
      </div>

    {/if}

    {#if bloc.filtered.length}
      <span class="resultline">
        Showing {bloc.firstShown}–{bloc.lastShown} of {bloc.filtered.length}{#if bloc.selected} · {bloc.label(bloc.selected)}{/if}
      </span>
    {/if}

    {#if bloc.isEmptyCategory}
      <!-- Reachable from a shared link after the data changes, even though a zero-count
           chip is never rendered. -->
      <div class="empty">
        <strong>No {bloc.label(bloc.selected ?? '').toLowerCase()} stories</strong>
        <span>Nothing in this category yet for {bloc.title}.</span>
        <button class="reset" onclick={() => bloc.selectCategory(null)}>Show all {bloc.total}</button>
      </div>
    {:else}
      <!-- No limit prop: the page has already cut the list, and AnimeNews regroups by
           month over whatever it is handed, so each page gets its own headers. -->
      <AnimeNews news={bloc.visible} />

      {#if bloc.pageCount > 1}
        <nav class="pager" aria-label="News pages">
          <button class="pg nav" disabled={bloc.current === 1} onclick={() => bloc.goToPage(bloc.current - 1)} aria-label="Previous page">←</button>
          {#each bloc.pageNumbers as n (n)}
            <button
              class="pg"
              class:on={bloc.current === n}
              aria-current={bloc.current === n ? 'page' : undefined}
              onclick={() => bloc.goToPage(n)}
            >{n}</button>
          {/each}
          <button class="pg nav" disabled={bloc.current === bloc.pageCount} onclick={() => bloc.goToPage(bloc.current + 1)} aria-label="Next page">→</button>
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
    color: var(--weeb-accent-text);
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
