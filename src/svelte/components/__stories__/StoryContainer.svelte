<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * A sized box for stories of components that take their dimensions from a
   * parent -- a poster card in a grid column, an avatar in a profile hero.
   *
   * `height` is optional: most callers only need to pin the width and let the
   * content set its own height. A component that fills its wrapper in both axes
   * collapses to nothing without it.
   */
  let {
    width = '320px',
    height = null,
    children,
  }: {
    width?: string;
    /** Only for components that fill their wrapper vertically as well. */
    height?: string | null;
    children?: Snippet;
  } = $props();
</script>

<div class="story-container" style="width: {width};{height ? ` height: ${height};` : ''}">
  {@render children?.()}
</div>
