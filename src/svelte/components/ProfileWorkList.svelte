<script lang="ts">
  import ProfileMediaList from './ProfileMediaList.svelte';
  import WorkStatusControl from './WorkStatusControl.svelte';
  import type { MediaListBloc, MediaListRow } from './MediaList.bloc.svelte';
  import { createWorkListBloc } from './ProfileWorkList.bloc.svelte';

  /**
   * The reading list at /profile/anime?medium=manga.
   *
   * The same shelf as the watchlist, on purpose: a reader switching between the
   * two finds the same controls in the same places. Only the medium differs, and
   * it differs in the bloc's config -- statuses, chapters rather than episodes,
   * /manga hrefs -- plus the row control below, which owns its own writes.
   */
  let {
    /** Server-prefetched reading list, counts and resolved status/page. */
    ssr = null,
    bloc = createWorkListBloc(() => ({ ssr })),
  }: {
    ssr?: any;
    bloc?: MediaListBloc;
  } = $props();
</script>

<ProfileMediaList {bloc} {rowActions} {emptyIcon} />

{#snippet rowActions(row: MediaListRow)}
  <WorkStatusControl
    workId={row.entry?.workID}
    userWork={{ id: row.entry?.id, status: row.entry?.status }}
  />
{/snippet}

{#snippet emptyIcon()}
  <svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
{/snippet}
