<script lang="ts">
  import PosterGrid from '$lib/components/primitives/PosterGrid.svelte';
  import PosterCard from '$lib/components/cards/PosterCard.svelte';
  import PosterCardSkeleton from '$lib/components/cards/PosterCardSkeleton.svelte';
  import AnimeCardSkeleton from '$lib/components/cards/AnimeCardSkeleton.svelte';
  import { noCardTracking } from '$lib/components/cards/Card.bloc.svelte';

  /**
   * Loaded cards and placeholders in the same PosterGrid, so the fit is
   * something you can look at rather than take on trust.
   *
   * This is why ProfileMediaList's loading state swapped skeletons:
   * `AnimeCardSkeleton` draws the *other* card -- a fixed 192x288 box with a
   * metadata column beside the art -- and in a fluid grid column it neither
   * fills the cell nor lands where the poster, title and sub-line arrive.
   * Switch `skeleton` to see the two against the real thing.
   */
  let { skeleton = 'poster' }: { skeleton?: 'poster' | 'anime' } = $props();

  const cards = [
    { id: '1', title: 'Sousou no Frieren', sub: '28 ep · 2023' },
    { id: '2', title: 'A Title Long Enough To Wrap Onto Its Second Line', sub: '12 ep · 2024' },
  ];
</script>

<PosterGrid>
  {#each cards as card (card.id)}
    <PosterCard
      id={card.id}
      title={card.title}
      image=""
      sub={card.sub}
      score={8.7}
      track={noCardTracking}
    />
  {/each}
  {#each Array(2) as _}
    {#if skeleton === 'poster'}
      <PosterCardSkeleton />
    {:else}
      <AnimeCardSkeleton />
    {/if}
  {/each}
</PosterGrid>
