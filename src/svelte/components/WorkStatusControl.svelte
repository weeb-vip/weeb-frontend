<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { createMutation } from '@tanstack/svelte-query';
  import { toast } from 'svelte-sonner';
  import Select from './Select.svelte';
  import { getQueryClient } from '../services/query-client';
  import { upsertWork, deleteWork } from '../../services/queries';
  import { WorkStatus } from '../../gql/graphql';

  /**
   * Put a work on your shelf, or move it.
   *
   * The reading counterpart of AnimeStatusDropdown, and deliberately a much
   * smaller thing: that component carries four visual variants and its own
   * menu, because it renders on cards, hero banners and list rows. This renders
   * in one place, so it borrows the themed Select instead of growing a second
   * dropdown implementation.
   */

  export let workId: string;
  /** The viewer's existing row, or null when signed out or untracked. */
  export let userWork: { id?: string | null; status?: string | null } | null = null;

  const queryClient = getQueryClient();

  // "Not tracking" is an option in the same list rather than a separate remove
  // button: it is where someone goes to undo, and hiding it behind a second
  // control makes removing harder than adding.
  const NOT_TRACKING = '';

  const OPTIONS = [
    { value: NOT_TRACKING, label: 'Not tracking' },
    { value: WorkStatus.Reading, label: 'Reading' },
    { value: WorkStatus.Plantoread, label: 'Plan to read' },
    { value: WorkStatus.Completed, label: 'Completed' },
    { value: WorkStatus.Onhold, label: 'On hold' },
    { value: WorkStatus.Dropped, label: 'Dropped' },
  ];

  // Local, so the control answers immediately and does not wait for a round
  // trip to show what the reader just chose.
  let status: string = userWork?.status ?? NOT_TRACKING;

  // Follow the server only when the server actually changes.
  //
  // Re-syncing whenever the prop is merely re-read undoes the reader's own
  // choice: this page's work comes from the SSR loader, so `userWork` still
  // says null for the moment after a successful write, and a plain
  // `status = userWork?.status` snapped the control back to "Not tracking"
  // while the row existed in the database.
  let serverStatus: string = userWork?.status ?? NOT_TRACKING;
  $: {
    const incoming = userWork?.status ?? NOT_TRACKING;
    if (incoming !== serverStatus) {
      serverStatus = incoming;
      status = incoming;
    }
  }

  const save = createMutation({
    mutationFn: async (next: string) => upsertWork().mutationFn({
      input: { workID: workId, status: next as WorkStatus },
    }),
    // invalidateAll, not just the query cache: this page is server-loaded, so
    // the cache holds nothing to invalidate and userWork would stay stale until
    // a manual reload.
    onSuccess: async () => {
      queryClient.invalidateQueries();
      await invalidateAll();
    },
    onError: (error: any) => {
      // Put the control back to what the server still believes.
      status = serverStatus;
      toast.error(authAware(error, 'Could not update your list'));
    },
  });

  const remove = createMutation({
    mutationFn: async () => deleteWork().mutationFn(workId),
    onSuccess: async () => {
      queryClient.invalidateQueries();
      await invalidateAll();
    },
    onError: (error: any) => {
      status = serverStatus;
      toast.error(authAware(error, 'Could not remove this from your list'));
    },
  });

  // The one error worth rewording. Everything else is shown as it arrives,
  // because a made-up message is harder to act on than a real one.
  function authAware(error: any, fallback: string): string {
    const text = String(error?.message ?? '').toLowerCase();
    if (
      text.includes('access denied') ||
      text.includes('unauthenticated') ||
      text.includes('unauthorized')
    ) {
      return 'Log in to keep track of what you are reading';
    }

    return fallback;
  }

  function onChange(detail: { value: string | number }) {
    const next = String(detail.value);
    status = next;

    if (next === NOT_TRACKING) {
      $remove.mutate();
      return;
    }

    $save.mutate(next);
  }
</script>

<div class="work-status">
  <Select
    value={status}
    options={OPTIONS}
    ariaLabel="Reading status"
    placeholder="Not tracking"
    disabled={$save.isPending || $remove.isPending}
    {onChange}
  />
</div>

<style>
  .work-status {
    display: inline-flex;
    align-items: center;
  }
</style>
