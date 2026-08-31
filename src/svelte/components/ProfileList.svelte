<script lang="ts">
  import { onMount } from 'svelte';
  import ProfileAnimeList from './ProfileAnimeList.svelte';
  import ProfileWorkList from './ProfileWorkList.svelte';

  /*
    One page, two media. The Anime | Manga switch sits above the status tabs and
    swaps the whole list beneath it -- each medium keeps its own list component,
    which owns its statuses, progress units and card links, so neither has to
    know the other exists.

    The medium lives in the URL (?medium=manga) so the choice survives a reload
    or a shared link, the same way the status and page below it do. Each list
    reads status and page from the URL itself; switching medium resets those by
    dropping them, because a manga "Reading" tab means nothing to the anime list.
  */

  type Medium = 'anime' | 'manga';

  /** Server-prefetched list, counts and resolved medium/status/page. */
  export let ssr: any = null;

  // Seed from the server's resolved medium so SSR renders the shelf the URL
  // actually names, not a default that the client then swaps -- which is the
  // whole reason the data is fetched on the server.
  let medium: Medium = ssr?.medium === 'manga' ? 'manga' : 'anime';
  let mounted = false;

  function readMedium(): Medium {
    if (typeof window === 'undefined') return medium;
    return new URLSearchParams(window.location.search).get('medium') === 'manga'
      ? 'manga'
      : 'anime';
  }

  function select(next: Medium) {
    if (next === medium) return;
    medium = next;
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (next === 'manga') url.searchParams.set('medium', 'manga');
      else url.searchParams.delete('medium');
      // Status and page belong to the other medium's tabs; drop them so the
      // incoming list opens on its own default rather than an alien status.
      url.searchParams.delete('status');
      url.searchParams.delete('page');
      window.history.pushState({}, '', url.toString());
    }
  }

  onMount(() => {
    medium = readMedium();
    mounted = true;
    const onPop = () => (medium = readMedium());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  });
</script>

<div class="profile-list">
  <div class="medium-row">
    <div class="medium-toggle" role="tablist" aria-label="Anime or manga">
      <button
        class="medium-btn {medium === 'anime' ? 'active' : ''}"
        role="tab"
        aria-selected={medium === 'anime'}
        on:click={() => select('anime')}
      >
        Anime
      </button>
      <button
        class="medium-btn {medium === 'manga' ? 'active' : ''}"
        role="tab"
        aria-selected={medium === 'manga'}
        on:click={() => select('manga')}
      >
        Manga
      </button>
    </div>
  </div>

  <!-- Rendered by the server's resolved medium, so the shelf is already right
       on first paint; the key remounts only when the viewer switches. The ssr
       payload seeds each list's own initialData. -->
  {#if medium === 'manga'}
    {#key 'manga'}
      <ProfileWorkList {ssr} />
    {/key}
  {:else}
    {#key 'anime'}
      <ProfileAnimeList {ssr} />
    {/key}
  {/if}
</div>

<style>
  /* The switch is the top level, the status tabs below it the second. It clears
     the nav with real breathing room, then sits one tight gap above the tabs so
     the two read as one filter header rather than a block jammed under the bar. */
  .profile-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 24px;
  }

  /* Carries the same horizontal inset as the list body below, so the switch
     starts on the same left edge as the status tabs. */
  .medium-row {
    padding: 0 var(--weeb-section-px, 48px);
  }

  /* A compact segmented control, sized to its two labels -- a mode switch, not a
     nav bar, so it stays light and lets the tabs and grid carry the weight. */
  .medium-toggle {
    display: inline-flex;
    gap: 3px;
    padding: 3px;
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    border-radius: 10px;
  }

  .medium-btn {
    appearance: none;
    border: none;
    background: transparent;
    color: var(--weeb-fg-secondary);
    font-size: 0.85rem;
    font-weight: 600;
    letter-spacing: -0.01em;
    padding: 6px 18px;
    border-radius: 7px;
    cursor: pointer;
    transition: background 0.18s ease, color 0.18s ease;
  }

  .medium-btn:hover:not(.active) {
    color: var(--weeb-fg);
    background: var(--weeb-surface-hover);
  }

  .medium-btn.active {
    background: var(--weeb-accent);
    color: #fff;
  }

  @media (max-width: 1024px) {
    .medium-row { padding: 0 24px; }
  }
  @media (max-width: 768px) {
    .profile-list { padding-top: 16px; }
    .medium-row { padding: 0 16px; }
  }
</style>
