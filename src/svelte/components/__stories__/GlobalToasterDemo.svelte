<script lang="ts">
  import { untrack } from 'svelte';
  import { toast } from 'svelte-sonner';
  import GlobalToaster from '../GlobalToaster.svelte';
  import { GlobalToasterBloc, fixedViewport } from '../GlobalToaster.bloc.svelte';

  /**
   * The toaster renders nothing until something calls `toast()`, so every story
   * goes through this: it mounts the real component with a pinned viewport and
   * raises one toast of each kind so the styling is actually visible.
   */
  let { mobile = false }: { mobile?: boolean } = $props();

  const bloc = new GlobalToasterBloc({ viewport: fixedViewport(untrack(() => mobile)) });

  function raiseAll() {
    toast.success('Added to your list', { description: 'Frieren: Beyond Journey’s End' });
    toast.error('Could not save that', { description: 'The gateway did not answer. Try again.' });
    toast.warning('Episode 12 airs in five minutes');
    toast.info('Titles are now showing in Japanese', {
      action: { label: 'Undo', onClick: () => toast('Reverted to English titles') },
    });
  }

  $effect(() => {
    raiseAll();
  });
</script>

<div class="demo">
  <button onclick={raiseAll}>Raise one of each</button>
  <button onclick={() => toast.dismiss()}>Dismiss all</button>
</div>

<GlobalToaster {bloc} />

<style>
  .demo {
    display: flex;
    gap: 8px;
    padding: calc(var(--weeb-nav-height, 60px) + 24px) 24px 24px;
  }
  button {
    font: inherit;
    font-size: 13px;
    padding: 7px 14px;
    border-radius: var(--weeb-radius-sm, 6px);
    border: 1px solid var(--weeb-border);
    background: var(--weeb-surface);
    color: var(--weeb-fg);
    cursor: pointer;
  }
  button:hover { background: var(--weeb-surface-hover); }
</style>
