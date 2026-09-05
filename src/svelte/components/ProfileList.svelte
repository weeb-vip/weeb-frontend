<script lang="ts">
  import ProfileAnimeList from './ProfileAnimeList.svelte';
  import ProfileWorkList from './ProfileWorkList.svelte';
  import Tabs from './Tabs.svelte';
  import { ProfileListBloc } from './ProfileList.bloc.svelte';
  import type { MediaListBloc } from './MediaList.bloc.svelte';

  /*
    One page, two media. The Anime | Manga switch sits above the status tabs and
    swaps the whole list beneath it -- each medium keeps its own entry point,
    which owns its statuses, progress units and card links, so neither has to
    know the other exists.
  */

  let {
    /** Server-prefetched list, counts and resolved medium/status/page. */
    ssr = null,
    bloc = new ProfileListBloc({ source: () => ({ ssr }) }),
    /**
     * The lists build their own blocs from `ssr`; these are the seam a story or
     * a test uses to hand them stubbed ones instead of letting them fetch.
     */
    animeBloc = undefined,
    workBloc = undefined,
  }: {
    ssr?: any;
    bloc?: ProfileListBloc;
    animeBloc?: MediaListBloc;
    workBloc?: MediaListBloc;
  } = $props();

  $effect(() => bloc.start());
</script>

<div class="profile-list">
  <div class="medium-row">
    <Tabs
      items={bloc.tabs}
      value={bloc.medium}
      onChange={(value) => bloc.select(value)}
      variant="segmented"
      ariaLabel="Anime or manga"
    />
  </div>

  <!-- Rendered by the server's resolved medium, so the shelf is already right
       on first paint; the key remounts only when the viewer switches. The ssr
       payload seeds each list's own initialData. -->
  {#if bloc.medium === 'manga'}
    {#key 'manga'}
      <ProfileWorkList {ssr} bloc={workBloc} />
    {/key}
  {:else}
    {#key 'anime'}
      <ProfileAnimeList {ssr} bloc={animeBloc} />
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

  @media (max-width: 1024px) {
    .medium-row { padding: 0 24px; }
  }
  @media (max-width: 768px) {
    .profile-list { padding-top: 16px; }
    .medium-row { padding: 0 16px; }
  }
</style>
