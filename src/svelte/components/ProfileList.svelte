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

  let medium: Medium = 'anime';
  let mounted = false;

  function readMedium(): Medium {
    if (typeof window === 'undefined') return 'anime';
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

  {#if !mounted}
    <!-- Server render defaults to anime; the client picks up ?medium on mount. -->
    <ProfileAnimeList />
  {:else if medium === 'manga'}
    {#key 'manga'}
      <ProfileWorkList />
    {/key}
  {:else}
    {#key 'anime'}
      <ProfileAnimeList />
    {/key}
  {/if}
</div>

<style>
  .profile-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* A segmented control, sized to its two labels rather than stretched across
     the page -- it is a mode switch, not a nav bar. */
  .medium-toggle {
    display: inline-flex;
    align-self: flex-start;
    gap: 4px;
    padding: 4px;
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    border-radius: 12px;
  }

  .medium-btn {
    appearance: none;
    border: none;
    background: transparent;
    color: var(--weeb-fg-secondary);
    font-size: 0.95rem;
    font-weight: 600;
    padding: 8px 20px;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .medium-btn:hover {
    color: var(--weeb-fg);
  }

  .medium-btn.active {
    background: var(--weeb-accent);
    color: #fff;
  }
</style>
