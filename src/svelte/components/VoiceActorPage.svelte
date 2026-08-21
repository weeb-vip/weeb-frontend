<script lang="ts">
  import SafeImage from './SafeImage.svelte';
  import { getYearUTC } from '../../services/utils';

  export let staff: any;
  export let ssrError: string | null = null;

  type FilterKey = 'all' | 'main' | 'supporting';

  let filter: FilterKey = 'all';

  $: name = `${staff?.givenName ?? ''} ${staff?.familyName ?? ''}`.trim();
  $: roles = staff?.roles ?? [];

  function isMain(role: string | null | undefined): boolean {
    const r = (role || '').toLowerCase();
    return r.includes('main') || r.includes('protagonist');
  }

  /**
   * Counted over roles, not anime. A voice actor can hold two credits in one
   * title -- a lead and a one-scene bit part -- and collapsing those to "1
   * anime" would understate the work. The anime count is reported separately.
   */
  $: mainCount = roles.filter((r: any) => isMain(r.character?.role)).length;
  $: supportingCount = roles.length - mainCount;
  $: animeCount = new Set(roles.filter((r: any) => r.anime).map((r: any) => r.anime.id)).size;

  $: filterOptions = [
    { key: 'all' as FilterKey, label: 'All', count: roles.length },
    { key: 'main' as FilterKey, label: 'Main', count: mainCount },
    { key: 'supporting' as FilterKey, label: 'Supporting', count: supportingCount }
  ].filter((o) => o.count > 0);

  // Already ordered newest-first by the API, so filtering preserves that and
  // there is nothing to re-sort here.
  $: filteredRoles = roles.filter((r: any) => {
    if (filter === 'all') return true;
    return filter === 'main' ? isMain(r.character?.role) : !isMain(r.character?.role);
  });

  /**
   * Roles are revealed a page at a time rather than all at once.
   *
   * Every card loads a character portrait from the CDN, and a prolific voice
   * actor has enough credits to put that well past the browser's six
   * connections per host: rendering all 117 of Mary Elizabeth McGlynn's roles
   * left 234 images still pending after eight seconds, because SafeImage
   * preloads in JS and its per-attempt timeouts pile up behind the queue.
   * A page of 24 keeps the first screen instant, and the rest arrive as they
   * are scrolled to.
   */
  const PAGE_SIZE = 24;
  let visibleCount = PAGE_SIZE;

  // Reset on filter change, or switching to a filter would keep an expansion
  // the reader never asked for on the new, shorter list.
  $: if (filter) visibleCount = PAGE_SIZE;

  $: visibleRoles = filteredRoles.slice(0, visibleCount);
  $: remaining = filteredRoles.length - visibleRoles.length;

  function showMore() {
    visibleCount += PAGE_SIZE;
  }

  /**
   * Auto-advance when the sentinel scrolls into view. The button stays in the
   * markup and keeps working on its own -- this only saves the reader a click
   * where IntersectionObserver exists.
   */
  function autoLoad(node: HTMLElement) {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) showMore();
      },
      { rootMargin: '400px' }
    );
    observer.observe(node);
    return { destroy: () => observer.disconnect() };
  }

  /**
   * The scraped profile fields are usually empty strings rather than nulls, so
   * every one of these needs a truthiness check or the page renders a column of
   * labels with nothing beside them.
   */
  $: details = [
    { label: 'Language', value: staff?.language },
    { label: 'Born', value: staff?.birthday },
    { label: 'Birthplace', value: staff?.birthPlace },
    { label: 'Blood type', value: staff?.bloodType },
    { label: 'Hobbies', value: staff?.hobbies }
  ].filter((d) => d.value);

  function animeHref(anime: any): string {
    // Falls back to the id for anime the slug backfill has not reached; the
    // /anime route resolves both.
    return `/anime/${anime.slug || anime.id}`;
  }
</script>

{#if ssrError}
  <div class="va-error">
    Could not load this voice actor right now. Please try again.
  </div>
{:else}
  <div class="va-root">
    <header class="va-header">
      <div class="va-portrait">
        <SafeImage
          src={staff.id}
          path="staff"
          alt={name}
          className="va-portrait-img"
          placeholderTitle={name}
          priority={true}
        />
      </div>

      <div class="va-identity">
        <p class="va-eyebrow">Voice actor</p>
        <h1 class="va-name">{name}</h1>

        {#if roles.length > 0}
          <p class="va-stats">
            <span class="va-stat-figure">{roles.length}</span>
            {roles.length === 1 ? 'role' : 'roles'}
            <span class="va-stat-sep">·</span>
            <span class="va-stat-figure">{animeCount}</span>
            {animeCount === 1 ? 'anime' : 'anime'}
            {#if mainCount > 0}
              <span class="va-stat-sep">·</span>
              <span class="va-stat-figure">{mainCount}</span> main
            {/if}
          </p>
        {/if}

        {#if details.length > 0}
          <dl class="va-details">
            {#each details as detail}
              <div class="va-detail">
                <dt>{detail.label}</dt>
                <dd>{detail.value}</dd>
              </div>
            {/each}
          </dl>
        {/if}

        {#if staff.summary}
          <p class="va-summary">{staff.summary}</p>
        {/if}
      </div>
    </header>

    <section class="va-roles" aria-labelledby="roles-heading">
      <div class="va-roles-head">
        <h2 class="va-section-heading" id="roles-heading">Roles</h2>
        {#if filterOptions.length > 1}
          <div class="va-filters">
            {#each filterOptions as option}
              <button
                class="va-filter-pill"
                class:active={filter === option.key}
                aria-pressed={filter === option.key}
                on:click={() => (filter = option.key)}
              >
                {option.label}
                <span class="va-filter-count">{option.count}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>

      {#if visibleRoles.length === 0}
        <p class="va-empty">No roles recorded for {name} yet.</p>
      {:else}
        <ul class="va-role-grid">
          <!--
            Keyed on the character id, not the name. The same character voiced
            across several seasons is a separate anime_character row per season
            and belongs in the list once per credit; keying on name would
            collapse three Motoko Kusanagi credits into one card.
          -->
          {#each visibleRoles as entry (entry.character.id)}
            <li class="va-role-card">
              <div class="va-role-character">
                <div class="va-char-portrait">
                  <SafeImage
                    src={entry.character.id}
                    path="characters"
                    alt={entry.character.name}
                    className="va-char-portrait-img"
                  />
                </div>
                <div class="va-char-text">
                  <p class="va-char-name">{entry.character.name}</p>
                  <span class="va-char-role" class:main={isMain(entry.character.role)}>
                    {entry.character.role}
                  </span>
                </div>
              </div>

              {#if entry.anime}
                <!-- No poster thumbnail here. It would double the page's image
                     count for a 30px crop that identifies nothing the title
                     does not; the title and year carry the anime. -->
                <a class="va-role-anime" href={animeHref(entry.anime)}>
                  <span class="va-anime-title">
                    {entry.anime.titleEn || entry.anime.titleJp}
                  </span>
                  <span class="va-anime-year">{getYearUTC(entry.anime.startDate)}</span>
                </a>
              {:else}
                <!-- Characters are not cascade-deleted with their anime, so a
                     credit can outlive the title it belongs to. -->
                <p class="va-role-anime va-role-anime--missing">Anime no longer listed</p>
              {/if}
            </li>
          {/each}
        </ul>

        {#if remaining > 0}
          <div class="va-more" use:autoLoad>
            <button class="va-more-button" on:click={showMore}>
              Show {Math.min(remaining, PAGE_SIZE)} more
              <span class="va-more-count">{remaining} left</span>
            </button>
          </div>
        {/if}
      {/if}
    </section>
  </div>
{/if}

<style>
  .va-root {
    width: 100%;
    padding: 0 var(--weeb-section-px, 48px) var(--weeb-section-py, 40px);
    display: flex;
    flex-direction: column;
    gap: var(--weeb-section-py, 40px);
  }

  .va-error {
    width: 100%;
    padding: 48px var(--weeb-section-px, 48px);
    color: var(--weeb-fg-secondary);
    font-size: 15px;
  }

  /* ── Header ── */

  .va-header {
    display: flex;
    align-items: flex-start;
    gap: 28px;
    padding-top: var(--weeb-section-py, 40px);
  }

  .va-portrait {
    flex-shrink: 0;
    width: 168px;
    aspect-ratio: 3 / 4;
    border-radius: var(--weeb-radius-lg, 12px);
    overflow: hidden;
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    box-shadow: var(--weeb-shadow-card);
  }
  .va-portrait :global(.va-portrait-img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .va-identity {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .va-eyebrow {
    margin: 0;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--weeb-fg-muted);
  }

  .va-name {
    margin: 0;
    font-size: clamp(28px, 4vw, 44px);
    font-weight: 800;
    line-height: 1.1;
    color: var(--weeb-fg);
  }

  .va-stats {
    margin: 0;
    font-size: 14px;
    color: var(--weeb-fg-secondary);
  }
  .va-stat-figure {
    color: var(--weeb-fg);
    font-weight: 700;
  }
  .va-stat-sep {
    margin: 0 6px;
    color: var(--weeb-fg-muted);
  }

  .va-details {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 24px;
    margin: 6px 0 0;
  }
  .va-detail {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .va-detail dt {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--weeb-fg-muted);
  }
  .va-detail dd {
    margin: 0;
    font-size: 13px;
    color: var(--weeb-fg-secondary);
  }

  .va-summary {
    margin: 6px 0 0;
    /* Prose gets a measure cap even though the page runs full width -- the
       grid below tiles, this is read. */
    max-width: 68ch;
    font-size: 14px;
    line-height: 1.6;
    color: var(--weeb-fg-secondary);
  }

  /* ── Roles ── */

  .va-roles {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .va-roles-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  .va-section-heading {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    color: var(--weeb-fg);
  }

  .va-filters {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .va-filter-pill {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 6px 14px;
    border-radius: var(--weeb-radius-full, 9999px);
    border: 1px solid var(--weeb-border);
    background: transparent;
    color: var(--weeb-fg-secondary);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
  }
  .va-filter-pill:hover {
    border-color: var(--weeb-accent);
    color: var(--weeb-fg);
  }
  .va-filter-pill.active {
    background: var(--weeb-accent);
    border-color: var(--weeb-accent);
    color: var(--weeb-fg);
  }
  .va-filter-count {
    font-size: 11px;
    font-weight: 700;
    opacity: 0.75;
  }

  .va-empty {
    margin: 0;
    font-size: 14px;
    color: var(--weeb-fg-muted);
  }

  .va-role-grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px;
  }

  .va-role-card {
    display: flex;
    flex-direction: column;
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius, 8px);
    overflow: hidden;
  }

  .va-role-character {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
  }

  /* 42x62, the size the source actually is. Character art on the CDN comes
     from MyAnimeList's /r/42x62/ thumbnail, so anything larger here is an
     upscale of a 42px image and looks it. */
  .va-char-portrait {
    flex-shrink: 0;
    width: 42px;
    height: 62px;
    border-radius: var(--weeb-radius-sm, 4px);
    overflow: hidden;
    background: var(--weeb-bg-elevated);
  }
  .va-char-portrait :global(.va-char-portrait-img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .va-char-text {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .va-char-name {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--weeb-fg);
    /* Scraped names run long ("Britannia, Cornelia li"), and a wrapped third
       line would make the cards ragged. */
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .va-char-role {
    align-self: flex-start;
    padding: 2px 8px;
    border-radius: var(--weeb-radius-sm, 4px);
    background: var(--weeb-bg-elevated);
    color: var(--weeb-fg-muted);
    font-size: 11px;
    font-weight: 600;
  }
  .va-char-role.main {
    background: color-mix(in oklch, var(--weeb-accent) 18%, transparent);
    color: var(--weeb-accent-text, var(--weeb-fg));
  }

  .va-role-anime {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    padding: 9px 12px;
    border-top: 1px solid var(--weeb-border);
    background: color-mix(in oklch, var(--weeb-bg) 45%, transparent);
    text-decoration: none;
    color: inherit;
    transition: background 0.15s;
  }
  a.va-role-anime:hover {
    background: var(--weeb-surface-hover);
  }
  a.va-role-anime:hover .va-anime-title {
    color: var(--weeb-accent-text, var(--weeb-fg));
  }

  .va-role-anime--missing {
    margin: 0;
    font-size: 12px;
    color: var(--weeb-fg-muted);
    font-style: italic;
  }

  .va-anime-title {
    min-width: 0;
    font-size: 13px;
    font-weight: 500;
    color: var(--weeb-fg-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: color 0.15s;
  }

  .va-anime-year {
    flex-shrink: 0;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: var(--weeb-fg-muted);
  }

  /* ── Show more ── */

  .va-more {
    display: flex;
    justify-content: center;
    padding-top: 4px;
  }
  .va-more-button {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 10px 20px;
    border-radius: var(--weeb-radius-full, 9999px);
    border: 1px solid var(--weeb-border);
    background: var(--weeb-surface);
    color: var(--weeb-fg-secondary);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
  }
  .va-more-button:hover {
    background: var(--weeb-surface-hover);
    border-color: var(--weeb-accent);
    color: var(--weeb-fg);
  }
  .va-more-count {
    font-size: 11px;
    font-weight: 500;
    color: var(--weeb-fg-muted);
  }

  /* ── Responsive ── */

  @media (max-width: 640px) {
    .va-header {
      flex-direction: column;
      gap: 20px;
    }
    .va-portrait {
      width: 132px;
    }
    .va-role-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
