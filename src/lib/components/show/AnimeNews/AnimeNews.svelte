<script lang="ts">
  import Chip from '$lib/components/primitives/Chip';
  import EmptyState from '$lib/components/primitives/EmptyState';
  import { colorFor, dayLabel, hostOf, newsRailView, sourceIcon } from './AnimeNews.logic';

  /**
   * AI-researched news for an anime, as a dated timeline rail.
   *
   * Each entry links out to the original article — these are third-party sources
   * summarised by the research pipeline, not our own reporting, so the source is
   * always named and the link always leaves the site.
   */
  let {
    news = [],
    /**
     * How many entries to render. The show page passes 5 — twelve items is more
     * page than the section deserves above Episodes. `null` renders everything,
     * which is what /anime/[slug]/news does.
     */
    limit = null,
    /** Where "View all" points. Omitted (on the all-news page itself) hides the link. */
    viewAllHref = null,
    /**
     * The heading level each headline takes in the page outline.
     *
     * The rail does not know what it is nested under, and a heading level is a
     * fact about the page, not about the component -- so it is passed in. The
     * default is 3, one level under the `<h2>` `ShowSection` emits, which is
     * where this rail is used on the show page; these were `<h4>` regardless,
     * so that outline read h2 -> h4 and skipped a level. The all-news page,
     * whose rail sits directly under its `<h1>`, passes 2.
     *
     * The look does NOT come from the tag: `.title` sets the size and weight
     * itself, so changing the level changes the outline and nothing on screen.
     */
    headingLevel = 3,
  }: {
    news?: any[];
    limit?: number | null;
    viewAllHref?: string | null;
    headingLevel?: 2 | 3 | 4;
  } = $props();

  const view = $derived(newsRailView(news, limit));
  const groups = $derived(view.groups);
  const headingTag = $derived(`h${headingLevel}` as 'h2' | 'h3' | 'h4');
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
          <svelte:element this={headingTag} class="title">
            {#if item.sourceUrl}
              <a class="title-link" href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
                {item.title}
                <span class="sr-only">(opens in a new tab)</span>
              </a>
            {:else}
              {item.title}
            {/if}
          </svelte:element>
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
              <!-- The category set is open, so the colour is passed rather than
                   named: Chip tints border, text and ground from whatever it is
                   given. -->
              <Chip label={item.category} size="sm" color={colorFor(item.category)} class="cat-chip" />
            {/if}
            {#if item.episodeNumber}
              <Chip label="Ep {item.episodeNumber}" size="sm" mono />
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

    {#if view.hiddenCount > 0 && viewAllHref}
      <a class="view-all" href={viewAllHref}>
        View all {view.total} news
        <svg viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h6" /><path d="M6.5 3.5L9 6l-2.5 2.5" />
        </svg>
      </a>
    {/if}
  </div>
{:else}
  <!-- The shared empty surface rather than a dashed box of its own: this one
       said the same thing in different type to every other "nothing here yet"
       on the site. -->
  <EmptyState
    size="compact"
    heading="No news yet"
    message="We'll add stories here as they're found."
  />
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
    /* Running text keeps a reading measure however wide the container gets;
       this measured ~208 characters per line on a 2526px screen. */
    max-width: 70ch;
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

  /* Shape and tint come from Chip -- this used to hardcode `border-radius:
     20px` with a comment explaining that the site's pill radius was a
     hardcoded 20px, which had not been true since the tokens landed. No colour
     dot: the rail beside the row already carries one. */
  :global(.cat-chip) {
    text-transform: capitalize;
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
