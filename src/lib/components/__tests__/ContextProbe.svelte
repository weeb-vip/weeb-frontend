<script lang="ts">
  import { getContext, untrack } from 'svelte';

  /**
   * Test support: reports whatever is under `contextKey` at the moment this
   * child initialises, which is the only moment `getContext` answers.
   */
  let {
    contextKey,
    onValue
  }: {
    contextKey: string;
    onValue: (value: unknown) => void;
  } = $props();

  // `untrack` only to keep the compiler from warning that a prop is read in the
  // init body -- which is deliberate here: init is when context exists.
  untrack(() => onValue(getContext(contextKey)));
</script>

<span data-testid="context-probe">child</span>
