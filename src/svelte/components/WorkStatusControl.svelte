<script lang="ts">
  import Select from './Select.svelte';
  import { WorkStatusControlBloc } from './WorkStatusControl.bloc.svelte';

  /**
   * Put a work on your shelf, or move it.
   *
   * The reading counterpart of AnimeStatusDropdown, and deliberately a much
   * smaller thing: that component carries four visual variants and its own
   * menu, because it renders on cards, hero banners and list rows. This renders
   * in one place, so it borrows the themed Select instead of growing a second
   * dropdown implementation.
   */

  let {
    workId,
    /** The viewer's existing row, or null when signed out or untracked. */
    userWork = null,
    /**
     * Defaults to a bloc that reads this component's props through an accessor,
     * so the call site stays `<WorkStatusControl {workId} {userWork} />`. The
     * accessor rather than an effect is what keeps the server's value on screen
     * from the first frame. Stories and tests inject their own.
     */
    bloc = new WorkStatusControlBloc({ work: () => ({ workId, userWork }) }),
  }: {
    workId: string;
    userWork?: { id?: string | null; status?: string | null } | null;
    bloc?: WorkStatusControlBloc;
  } = $props();
</script>

<div class="work-status">
  <Select
    value={bloc.status}
    options={bloc.options}
    ariaLabel="Reading status"
    placeholder="Not tracking"
    disabled={bloc.busy}
    onChange={(detail) => bloc.selectStatus(String(detail.value))}
  />
</div>

<style>
  .work-status {
    display: inline-flex;
    align-items: center;
  }
</style>
