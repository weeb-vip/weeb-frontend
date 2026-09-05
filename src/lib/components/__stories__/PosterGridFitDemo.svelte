<script lang="ts">
  import PosterGrid from '$lib/components/primitives/PosterGrid.svelte';
  import PosterCard from '$lib/components/cards/PosterCard.svelte';
  import PosterCardSkeleton from '$lib/components/cards/PosterCardSkeleton.svelte';
  import { noCardTracking } from '$lib/components/cards/Card.bloc.svelte';

  /**
   * Loaded cards and placeholders in the same PosterGrid, so the fit is
   * something you can look at rather than take on trust: the poster box, the
   * title line and the sub-line land where the loaded card puts them, and the
   * cell width is the grid's rather than the skeleton's.
   */
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
    <PosterCardSkeleton />
  {/each}
</PosterGrid>
