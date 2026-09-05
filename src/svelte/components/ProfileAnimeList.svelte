<script lang="ts">
  import AnimeStatusDropdown from './AnimeStatusDropdown.svelte';
  import ProfileMediaList from './ProfileMediaList.svelte';
  import type { MediaListBloc, MediaListRow } from './MediaList.bloc.svelte';
  import { createAnimeListBloc } from './ProfileAnimeList.bloc.svelte';

  /**
   * The watchlist at /profile/anime.
   *
   * The shelf itself is ProfileMediaList, which draws the reading list too --
   * this is the anime entry point: the medium's bloc, its row control, and the
   * icon its empty state wears.
   */
  let {
    /** Server-prefetched list, counts and resolved status/page. */
    ssr = null,
    /**
     * The accessor rather than an effect is what keeps the server's shelf on
     * screen from the first frame. Stories and tests inject their own.
     */
    bloc = createAnimeListBloc(() => ({ ssr })),
  }: {
    ssr?: any;
    bloc?: MediaListBloc;
  } = $props();
</script>

<ProfileMediaList {bloc} {rowActions} {emptyIcon} />

{#snippet rowActions(row: MediaListRow)}
  <AnimeStatusDropdown
    entry={{ id: row.entry?.id, anime: row.entry?.anime, status: row.entry?.status }}
    variant="compact"
    onStatusChange={({ animeId, status }) => bloc.changeStatus(animeId, status)}
    onDelete={({ animeId }) => bloc.remove(animeId)}
  />
{/snippet}

{#snippet emptyIcon()}
  <svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
    <path d="M9 10h.01M15 10h.01M9.5 15.5a3.5 3.5 0 0 0 5 0" />
  </svg>
{/snippet}
