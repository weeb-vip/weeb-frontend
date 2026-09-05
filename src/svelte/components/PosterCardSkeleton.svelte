<script lang="ts">
  import Skeleton from './Skeleton.svelte';

  /**
   * A `PosterCard`-shaped placeholder: 2:3 poster, title line, subtitle line.
   *
   * Every page with a poster grid had written its own -- the homepage's
   * `.poster-card-skeleton` and the season page's `.skeleton-card` were the
   * same three boxes with different class names and their own copy of a
   * `shimmer` keyframe, each declaring a slightly different pulse. One shape,
   * one animation, and it comes from `Skeleton` like every other placeholder.
   *
   * Presentational -- no bloc. Whoever knows the grid is loading renders it.
   */
  let { class: className = '' }: { class?: string } = $props();
</script>

<div class="poster-card-skeleton {className}">
  <Skeleton className="w-full aspect-2/3 rounded-lg" />
  <Skeleton className="h-3.5 w-4/5 mt-2" />
  <Skeleton className="h-3 w-3/5 mt-1" />
</div>

<style>
  .poster-card-skeleton {
    display: flex;
    flex-direction: column;
    width: 100%;
  }
</style>
