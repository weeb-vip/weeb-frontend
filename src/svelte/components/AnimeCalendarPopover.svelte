<script lang="ts">
  import AnimeCard from './AnimeCard.svelte';
  import { clickOutside } from '../actions/clickOutside';
  import { anchoredPosition } from '../actions/anchoredPosition';
  import { GetImageFromAnime, getYearUTC } from '../../services/utils';
  import { AnimeCalendarPopoverBloc } from './AnimeCalendarPopover.bloc.svelte';

  let {
    anime,
    bloc: injected
  }: {
    anime: any;
    bloc?: AnimeCalendarPopoverBloc;
  } = $props();

  const ownBloc = new AnimeCalendarPopoverBloc({
    get anime() {
      return anime;
    }
  });
  const bloc = $derived(injected ?? ownBloc);

  let buttonRef = $state<HTMLButtonElement | undefined>();

  $effect(() => bloc.watchViewport());
</script>

<button
  bind:this={buttonRef}
  onclick={() => bloc.togglePopover()}
  title={bloc.buttonTitle}
  aria-expanded={bloc.isOpen}
  class="text-xs text-weeb-accent-text text-left hover:bg-weeb-surface-hover bg-weeb-surface px-2 py-1 rounded transition-colors duration-300 w-full flex flex-col"
>
  <span class="truncate">
    {bloc.title} (Ep {bloc.episodeNumber})
  </span>
  {#if bloc.airTimeText}
    <span class="text-weeb-fg-muted text-xs font-medium">
      {bloc.airTimeText}
    </span>
  {/if}
</button>

{#if bloc.isOpen}
  <!-- Phone backdrop: a bigger target for dismissing than the card's own edge.
       Hidden from md up by the utility, so no viewport is measured to decide. -->
  <button
    type="button"
    class="fixed inset-0 bg-black/20 z-40 md:hidden cursor-default"
    aria-label="Close popover"
    onclick={() => bloc.closePopover()}
  ></button>

  <div
    class="calendar-popover"
    use:clickOutside={{ handler: () => bloc.closePopover(), ignore: () => buttonRef }}
    use:anchoredPosition={{
      anchor: () => buttonRef,
      align: bloc.isCompact ? 'center' : 'left',
      gap: 8,
      margin: bloc.isCompact ? 16 : 8
    }}
  >
    <AnimeCard
      style="episode"
      forceListLayout={true}
      id={bloc.anime.id}
      slug={bloc.anime.slug}
      title={bloc.title}
      tags={bloc.anime.tags || []}
      episodes={bloc.anime.episodeCount || 0}
      episodeLength={bloc.episodeLength}
      image={GetImageFromAnime(bloc.anime)}
      className="hover:cursor-pointer"
      year={getYearUTC(bloc.anime.startDate)}
      airdate={bloc.airDateLabel}
      episodeTitle={bloc.episodeTitle}
      episodeNumber={bloc.episodeNumber}
    />
  </div>
{/if}

<style>
  /* Viewport coordinates: `anchoredPosition` sets top/left as a fixed element,
     which is why no scroll offset belongs anywhere near this. */
  .calendar-popover {
    position: fixed;
    z-index: 50;
    width: 420px;
    max-height: 70vh;
    overflow-y: auto;
    padding: 12px;
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius-lg, 12px);
    box-shadow: var(--weeb-shadow-dropdown);
    transition: background 0.3s, border-color 0.3s;
  }

  @media (max-width: 767px) {
    .calendar-popover {
      width: 350px;
      max-width: calc(100vw - 32px);
    }
  }
</style>
