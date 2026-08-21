<script lang="ts">
  /**
   * AI-researched news for an anime, as a dated timeline rail.
   *
   * Each entry links out to the original article — these are third-party sources
   * summarised by the research pipeline, not our own reporting, so the source is
   * always named and the link always leaves the site.
   */
  export let news: any[] = [];

  /**
   * How many entries to render. The show page passes 5 — twelve items is more
   * page than the section deserves above Episodes. `null` renders everything,
   * which is what /anime/[slug]/news does.
   */
  export let limit: number | null = null;

  /** Where "View all" points. Omitted (on the all-news page itself) hides the link. */
  export let viewAllHref: string | null = null;

  // Category → colour. Semantic rather than decorative: the reader learns the
  // code once. The set is NOT closed — the research model can emit anything —
  // so anything unrecognised falls back to muted instead of rendering unstyled.
  const CATEGORY_COLORS: Record<string, string> = {
    announcement: 'var(--weeb-accent)',
    release: 'var(--weeb-green)',
    staff: 'var(--weeb-violet)',
    reception: 'var(--weeb-amber)'
  };

  function colorFor(category: string | null | undefined): string {
    return CATEGORY_COLORS[(category || '').toLowerCase()] || 'var(--weeb-fg-muted)';
  }

  /**
   * Brand glyph per referenced host, so "where does this go" reads before the label.
   * Inline rather than fetched: a remote favicon is a third-party request per row and
   * several of these hosts 403 hotlinked assets — the same reason StreamingPlatforms
   * self-hosts its logos under /assets/streams.
   */
  const SOURCE_ICONS: Record<string, { brand: string; d: string; outline?: boolean }> = {
    youtube: {
      brand: 'oklch(58% 0.22 27)',
      d: 'M11.4 3.6c-.13-.5-.5-.88-1-1C9.5 2.4 6 2.4 6 2.4s-3.5 0-4.4.2c-.5.12-.87.5-1 1C.4 4.5.4 6 .4 6s0 1.5.2 2.4c.13.5.5.88 1 1 .9.2 4.4.2 4.4.2s3.5 0 4.4-.2c.5-.12.87-.5 1-1 .2-.9.2-2.4.2-2.4s0-1.5-.2-2.4zM4.8 7.8V4.2L7.9 6 4.8 7.8z'
    },
    x: {
      brand: 'oklch(88% 0.01 270)',
      d: 'M9.2 1h1.7L7.2 5.2l4.4 5.8H8.2L5.6 7.6 2.6 11H.9l4-4.5L.7 1h3.5l2.4 3.2L9.2 1zm-.6 9h.9L3.5 1.9h-1L8.6 10z'
    },
    niconico: {
      brand: 'oklch(72% 0.16 250)',
      d: 'M1 3h10v6H8.2l-1.1 2-1.1-2H1V3zm1.4 1.4v3.2h7.2V4.4H2.4z'
    },
    vimeo: {
      brand: 'oklch(72% 0.14 210)',
      d: 'M11.6 3.7c-.05 1.1-.83 2.63-2.33 4.57C7.72 10.3 6.4 11.3 5.3 11.3c-.68 0-1.26-.63-1.73-1.9L2.63 6.06C2.28 4.8 1.9 4.17 1.5 4.17c-.09 0-.39.18-.9.53L.06 4.03c.63-.55 1.25-1.1 1.86-1.66.84-.72 1.47-1.1 1.89-1.14.99-.1 1.6.58 1.83 2.02.25 1.56.42 2.53.52 2.91.29 1.3.6 1.95.95 1.95.27 0 .67-.42 1.2-1.27.53-.85.82-1.5.86-1.94.08-.79-.23-1.19-.94-1.19-.33 0-.68.08-1.03.23.68-2.24 1.99-3.33 3.92-3.27 1.43.04 2.1.97 2.02 2.79z'
    },
    site: {
      brand: 'var(--weeb-accent-hover)',
      d: 'M6 .8a5.2 5.2 0 100 10.4A5.2 5.2 0 006 .8zm3.6 3.4H8.1a8 8 0 00-.8-2.1 4.2 4.2 0 012.3 2.1zM6 1.9c.4.5.7 1.3.9 2.3H5.1c.2-1 .5-1.8.9-2.3zM1.9 6c0-.3 0-.6.1-.9h1.7a9.6 9.6 0 000 1.8H2c0-.3-.1-.6-.1-.9zm.5 1.8h1.5c.2.8.4 1.5.8 2.1a4.2 4.2 0 01-2.3-2.1zm1.5-3.6H2.4a4.2 4.2 0 012.3-2.1 8 8 0 00-.8 2.1zM6 10.1c-.4-.5-.7-1.3-.9-2.3h1.8c-.2 1-.5 1.8-.9 2.3zm1.1-3.4H4.9a8.7 8.7 0 010-1.4h2.2a8.7 8.7 0 010 1.4zm.2 3.2c.4-.6.6-1.3.8-2.1h1.5a4.2 4.2 0 01-2.3 2.1zM8.3 6a9.6 9.6 0 000-1.8H10a4.3 4.3 0 010 1.8H8.3z'
    },
    link: {
      brand: 'var(--weeb-fg-muted)',
      outline: true,
      d: 'M5 7l-1.4 1.4a2 2 0 01-2.8-2.8L2.2 4.2M7 5l1.4-1.4a2 2 0 012.8 2.8L9.8 7.8M4.6 7.4l2.8-2.8'
    }
  };

  function hostOf(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  function sourceIcon(url: string, kind: string | null | undefined) {
    const h = hostOf(url);
    if (h.includes('youtube') || h.includes('youtu.be')) return SOURCE_ICONS.youtube;
    if (h.includes('nicovideo')) return SOURCE_ICONS.niconico;
    if (h.includes('vimeo')) return SOURCE_ICONS.vimeo;
    if (h === 'x.com' || h.includes('twitter')) return SOURCE_ICONS.x;
    if (kind === 'site') return SOURCE_ICONS.site;
    return SOURCE_ICONS.link;
  }

  function parseDate(value: string | null | undefined): Date | null {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  const MONTH_FMT = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' });
  const DAY_FMT = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' });

  /**
   * Newest first, grouped by month. Items with no usable publishedDate keep their
   * relative order and collect in a trailing "Undated" group — one of the twelve
   * staging items has none, and it must never render as "Invalid Date".
   */
  $: usable = (news || []).filter((n) => n && (n.title || '').trim());

  // Sort before slicing — "latest 5" must mean the 5 newest, not the first 5
  // the API happened to return. Undated items trail the dated ones.
  $: ordered = (() => {
    const dated = usable
      .map((n) => ({ item: n, date: parseDate(n.publishedDate) }))
      .filter((x) => x.date !== null) as { item: any; date: Date }[];
    dated.sort((a, b) => b.date.getTime() - a.date.getTime());
    const undated = usable.filter((n) => parseDate(n.publishedDate) === null);
    return [...dated.map((d) => d.item), ...undated];
  })();

  $: visible = limit === null ? ordered : ordered.slice(0, limit);
  $: hiddenCount = Math.max(0, usable.length - visible.length);

  $: groups = (() => {
    const out: { label: string; items: any[] }[] = [];
    for (const item of visible) {
      const d = parseDate(item.publishedDate);
      const label = d ? MONTH_FMT.format(d) : 'Undated';
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(item);
      else out.push({ label, items: [item] });
    }
    return out;
  })();

  function dayLabel(value: string | null | undefined): string {
    const d = parseDate(value);
    return d ? DAY_FMT.format(d) : '—';
  }
</script>

{#if groups.length}
  <div class="news-rail">
    {#each groups as group (group.label)}
      <div class="month">{group.label}</div>

      {#each group.items as item (item.id || item.title)}
        <!-- The row is NOT a single anchor. It used to be, which read nicely but made the
             reference chips unclickable: anchors cannot nest, so they had to be spans.
             Now the headline is the link to the article and each reference is its own
             link; the row keeps its hover treatment through :focus-within / :hover. -->
        <article class="row" style="--dot: {colorFor(item.category)}">
          <h4 class="title">
            {#if item.sourceUrl}
              <a class="title-link" href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
                {item.title}
                <span class="sr-only">(opens in a new tab)</span>
              </a>
            {:else}
              {item.title}
            {/if}
          </h4>
          <span class="date">{dayLabel(item.publishedDate)}</span>

          {#if item.summary}
            <p class="summary">{item.summary}</p>
          {/if}

          <!-- Media the article points at. Rendered only when present, so this stays inert
               until anime-api ships the `references` field and the query asks for it. -->
          {#if item.references?.length}
            <div class="refs">
              {#each item.references as ref (ref.url)}
                <a class="ref" href={ref.url} target="_blank" rel="noopener noreferrer">
                  <svg
                    class="ref-ico"
                    viewBox="0 0 12 12"
                    aria-hidden="true"
                    style="--brand: {sourceIcon(ref.url, ref.kind).brand}"
                    fill={sourceIcon(ref.url, ref.kind).outline ? 'none' : 'currentColor'}
                    stroke={sourceIcon(ref.url, ref.kind).outline ? 'currentColor' : 'none'}
                    stroke-width="1.3"
                    stroke-linecap="round"
                  >
                    <path d={sourceIcon(ref.url, ref.kind).d} />
                  </svg>
                  <span class="ref-title">{ref.title}</span>
                  <span class="ref-host">{hostOf(ref.url)}</span>
                </a>
              {/each}
            </div>
          {/if}

          <div class="meta">
            {#if item.category}
              <span class="badge" style="--cat: {colorFor(item.category)}">{item.category}</span>
            {/if}
            {#if item.episodeNumber}
              <span class="ep">Ep {item.episodeNumber}</span>
            {/if}
            <!-- Language of the SOURCE article; our summary is always English. Tells a
                 reader the link is Japanese before they follow it. Guarded like
                 references, so it stays inert until the API ships the field. -->
            {#if item.language}
              <span class="lang" class:jp={item.language === 'ja'}>{item.language.toUpperCase()}</span>
            {/if}
            {#if item.sourceName}
              <!-- A second route to the same article as the headline. It already carries
                   the external-link glyph, so it reads as clickable — leaving it inert
                   while it looks like a link is worse than not showing it. -->
              {#if item.sourceUrl}
                <a class="source" href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
                  {item.sourceName}
                  <svg class="ext" viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4.5 2.5h5v5" />
                    <path d="M9.5 2.5L4 8" />
                    <path d="M9 7.5v2h-7v-7h2" />
                  </svg>
                  <span class="sr-only">(opens in a new tab)</span>
                </a>
              {:else}
                <span class="source">{item.sourceName}</span>
              {/if}
            {/if}
          </div>
        </article>
      {/each}
    {/each}

    {#if hiddenCount > 0 && viewAllHref}
      <a class="view-all" href={viewAllHref}>
        View all {usable.length} news
        <svg viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h6" /><path d="M6.5 3.5L9 6l-2.5 2.5" />
        </svg>
      </a>
    {/if}
  </div>
{:else}
  <div class="news-empty">
    <strong>No news yet</strong>
    <span>We'll add stories here as they're found.</span>
  </div>
{/if}

<style>
  .news-rail {
    display: flex;
    flex-direction: column;
  }

  .month {
    font-family: var(--weeb-font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--weeb-fg-muted);
    padding: 14px 0 8px 28px;
    margin-left: 4px;
    border-left: 1px solid var(--weeb-border);
  }
  .month:first-child {
    padding-top: 0;
  }

  .row {
    position: relative;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 3px 14px;
    padding: 10px 10px 12px 28px;
    margin-left: 4px;
    border-left: 1px solid var(--weeb-border);
    color: inherit;
    text-decoration: none;
    border-radius: 0 var(--weeb-radius) var(--weeb-radius) 0;
    transition: background 140ms ease;
  }

  /* The dot sits ON the rail and carries the category colour. */
  .row::before {
    content: '';
    position: absolute;
    left: -4px;
    top: 15px;
    width: 8px;
    height: 8px;
    border-radius: var(--weeb-radius-full);
    background: var(--dot);
    box-shadow: 0 0 0 3px var(--weeb-bg);
  }

  /* Hover/focus now live on the row as a container, driven by whichever link inside it
     the pointer or keyboard is on. focus-within keeps the row highlighted while tabbing
     through the headline and its references. */
  .row:hover,
  .row:focus-within {
    background: color-mix(in oklch, var(--weeb-surface) 60%, transparent);
  }
  .row:hover .ext {
    transform: translate(1px, -1px);
  }

  .title-link {
    color: inherit;
    text-decoration: none;
    transition: color 140ms ease;
  }
  .title-link:hover {
    color: var(--weeb-accent-hover);
  }
  .title-link:focus-visible {
    outline: 2px solid var(--weeb-accent-hover);
    outline-offset: 2px;
    border-radius: var(--weeb-radius-sm);
  }

  .title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.38;
    text-wrap: balance;
    transition: color 140ms ease;
    /* Same min-width:auto trap as .refs — a long unbroken headline (a URL, a
       romanised title with no spaces) would otherwise widen the 1fr column. */
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .date {
    font-family: var(--weeb-font-mono);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: var(--weeb-fg-muted);
    white-space: nowrap;
    align-self: start;
    padding-top: 2px;
  }

  .summary {
    grid-column: 1 / -1;
    margin: 2px 0 0;
    font-size: 12.5px;
    line-height: 1.5;
    color: var(--weeb-fg-secondary);
    /* Two lines keeps a long summary from setting the row height; the full
       text is one click away at the source. */
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Referenced media. These are spans, not links: the whole row is already an <a>, and
     nesting anchors is invalid HTML that browsers resolve unpredictably. They identify
     what the article points at; the row click still goes to the article itself. */
  .refs {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
    /* Grid items default to min-width:auto, which lets a nowrap chip widen the row
       past the viewport instead of being clamped by it. */
    min-width: 0;
  }

  .ref {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 11.5px;
    color: var(--weeb-fg-secondary);
    background: color-mix(in oklch, var(--weeb-surface) 75%, transparent);
    border: 1px solid var(--weeb-border);
    border-radius: 20px;
    padding: 3px 11px 3px 8px;
    white-space: nowrap;
    /* A chip stays on one line, so on a narrow screen it has to be allowed to
       shrink and ellipsise its title — otherwise it scrolls the whole page. */
    max-width: 100%;
    min-width: 0;
    overflow: hidden;
  }

  .ref-title {
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }

  .ref {
    text-decoration: none;
    transition: border-color 140ms ease, color 140ms ease;
  }
  .ref:hover {
    color: var(--weeb-fg);
    border-color: color-mix(in oklch, var(--weeb-accent) 55%, var(--weeb-border));
  }
  .ref:focus-visible {
    outline: 2px solid var(--weeb-accent-hover);
    outline-offset: 2px;
  }

  .ref-ico {
    width: 12px;
    height: 12px;
    flex: none;
    color: var(--brand);
  }

  .ref-host {
    font-family: var(--weeb-font-mono);
    font-size: 10px;
    color: var(--weeb-fg-muted);
    flex: none;
  }

  .lang {
    font-family: var(--weeb-font-mono);
    font-size: 9.5px;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: var(--weeb-fg-secondary);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius-sm);
    padding: 1px 5px;
  }
  .lang.jp {
    color: var(--weeb-violet);
    border-color: color-mix(in oklch, var(--weeb-violet) 40%, transparent);
  }

  .meta {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 6px;
  }

  /* Pill, matching .hero-tag and .genre-pill — the site's pill radius is a
     hardcoded 20px rather than a token, so this follows suit deliberately.
     No colour dot here: the rail already carries one, and the site's pills
     have no leading marker. */
  .badge {
    display: inline-flex;
    align-items: center;
    font-size: 11px;
    font-weight: 500;
    padding: 3px 11px;
    border-radius: 20px;
    border: 1px solid color-mix(in oklch, var(--cat) 40%, var(--weeb-border));
    color: var(--cat);
    background: color-mix(in oklch, var(--cat) 12%, transparent);
    text-transform: capitalize;
    white-space: nowrap;
  }

  .ep {
    font-family: var(--weeb-font-mono);
    font-size: 10px;
    color: var(--weeb-fg-secondary);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius-sm);
    padding: 1px 5px;
  }

  .source {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-family: var(--weeb-font-mono);
    font-size: 10.5px;
    color: var(--weeb-fg-muted);
  }
  a.source {
    text-decoration: none;
    transition: color 140ms ease;
  }
  a.source:hover {
    color: var(--weeb-accent-hover);
  }
  a.source:focus-visible {
    outline: 2px solid var(--weeb-accent-hover);
    outline-offset: 2px;
    border-radius: var(--weeb-radius-sm);
  }

  .ext {
    width: 10px;
    height: 10px;
    flex: none;
    transition: transform 140ms ease;
  }

  /* Sits on the rail's baseline so the timeline reads as continuing into the
     full list rather than stopping short. */
  .view-all {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    align-self: flex-start;
    margin: 6px 0 0 4px;
    padding: 8px 14px 8px 28px;
    border-left: 1px solid var(--weeb-border);
    font-size: 13px;
    font-weight: 500;
    color: var(--weeb-accent-text);
    text-decoration: none;
    transition: color 140ms ease;
  }
  .view-all svg {
    width: 12px;
    height: 12px;
    transition: transform 140ms ease;
  }
  .view-all:hover {
    color: var(--weeb-accent-hover);
  }
  .view-all:hover svg {
    transform: translateX(2px);
  }
  .view-all:focus-visible {
    outline: 2px solid var(--weeb-accent-hover);
    outline-offset: 2px;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .news-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 26px 14px;
    text-align: center;
    border: 1px dashed var(--weeb-border);
    border-radius: var(--weeb-radius);
  }
  .news-empty strong {
    font-size: 14px;
    font-weight: 600;
  }
  .news-empty span {
    font-size: 13px;
    color: var(--weeb-fg-muted);
  }

  @media (prefers-reduced-motion: reduce) {
    .row,
    .title,
    .ext {
      transition: none;
    }
  }

  @media (max-width: 480px) {
    .row {
      padding-left: 22px;
    }
    .month {
      padding-left: 22px;
    }
  }
</style>
