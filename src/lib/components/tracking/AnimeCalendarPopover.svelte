<script lang="ts">
  import Chip from '$lib/components/primitives/Chip.svelte';
  import SafeImage from '$lib/components/primitives/SafeImage.svelte';
  import { clickOutside } from '$lib/actions/clickOutside';
  import { anchoredPosition } from '$lib/actions/anchoredPosition';
  import { GetImageFromAnime, animeHref } from '$lib/services/utils';
  import { realCardTracking, type CardTrackingPort } from '$lib/components/cards/Card.bloc.svelte';
  import { AnimeCalendarPopoverBloc } from './AnimeCalendarPopover.bloc.svelte';

  /**
   * The episode row inside this popover used to be `cards/AnimeCard` -- 257
   * lines and nine stories serving exactly one caller, which is this file. It
   * declared seven `style` values of which two rendered a body at all, and of
   * those two only `episode` was ever asked for; the other five were a poster
   * in a fixed `w-48 h-72` box. It also carried a top-left accent pill reading
   * "Watching" that no call site could reach, because the popover never passes
   * an `entry`.
   *
   * COMPONENT_ARCHITECTURE is explicit that `src/lib/components/` is for things
   * with more than one caller, so the row came here rather than being renamed
   * to `CalendarEpisodeRow` and left in `cards/`. What survived is the fifty
   * lines the popover actually asked for.
   */
  let {
    anime,
    bloc: injected,
    track = realCardTracking
  }: {
    anime: any;
    bloc?: AnimeCalendarPopoverBloc;
    track?: CardTrackingPort;
  } = $props();

  const ownBloc = new AnimeCalendarPopoverBloc({
    get anime() {
      return anime;
    }
  });
  const bloc = $derived(injected ?? ownBloc);

  let buttonRef = $state<HTMLButtonElement | undefined>();

  $effect(() => bloc.watchViewport());

  const href = $derived(animeHref({ id: bloc.anime.id, slug: bloc.anime.slug }));
  // Three is what fits on one line beside the poster at this width; the row
  // used to marquee the whole list on hover, which a touch device cannot reach
  // -- and this popover opens from a tap.
  const tags = $derived((bloc.anime.tags ?? []).slice(0, 3));
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
    class="calendar-popover weeb-floating"
    use:clickOutside={{ handler: () => bloc.closePopover(), ignore: () => buttonRef }}
    use:anchoredPosition={{
      anchor: () => buttonRef,
      align: bloc.isCompact ? 'center' : 'left',
      gap: 8,
      margin: bloc.isCompact ? 16 : 8
    }}
  >
    <a class="episode-row" {href} onclick={() => track(bloc.anime.id, bloc.title)}>
      <span class="episode-art">
        <SafeImage
          src={GetImageFromAnime(bloc.anime)}
          alt=""
          className="episode-art-img"
          fallbackSrc="/assets/not found.jpg"
          cdnWidth={240}
        />
      </span>

      <span class="episode-body">
        <!-- Two lines and a clamp, not a hover marquee: the title is the whole
             point of the popover. -->
        <span class="episode-show">{bloc.title}</span>
        {#if tags.length > 0}
          <span class="episode-tags">
            {#each tags as tag (tag)}
              <Chip label={tag} size="sm" />
            {/each}
          </span>
        {/if}
        {#if bloc.episodeTitle}
          <span class="episode-title">{bloc.episodeTitle}</span>
        {/if}
        <span class="episode-meta">
          <span>Episode {bloc.episodeNumber}</span>
          {#if bloc.airDateLabel}<span>{bloc.airDateLabel}</span>{/if}
        </span>
      </span>
    </a>
  </div>
{/if}

<style>
  /* Viewport coordinates: `anchoredPosition` sets top/left as a fixed element,
     which is why no scroll offset belongs anywhere near this. */
  /* This was the one surface already drawn correctly, so `.weeb-floating` is
     its values -- ground, hairline, radius-lg, --weeb-shadow-dropdown -- lifted
     out for the other six to share. It outranks a menu, so it takes the popover
     layer rather than the dropdown one. */
  .calendar-popover {
    position: fixed;
    z-index: var(--weeb-z-popover);
    width: 420px;
    max-height: 70vh;
    overflow-y: auto;
    padding: 12px;
    transition: background 0.3s, border-color 0.3s;
  }

  .episode-row {
    display: flex;
    gap: 12px;
    text-decoration: none;
    color: inherit;
    border-radius: var(--weeb-radius);
  }
  .episode-row:focus-visible {
    outline: 2px solid var(--weeb-accent);
    outline-offset: 2px;
  }

  .episode-art {
    flex: 0 0 auto;
    width: 96px;
    aspect-ratio: 2 / 3;
    border-radius: var(--weeb-radius);
    overflow: hidden;
    background: var(--weeb-bg-elevated);
  }
  .episode-art :global(.episode-art-img),
  .episode-art :global(.episode-art-img img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .episode-body {
    min-width: 0;
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .episode-show {
    font-size: 15px;
    font-weight: 600;
    line-height: 1.3;
    color: var(--weeb-fg);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .episode-row:hover .episode-show {
    color: var(--weeb-accent-text);
  }

  .episode-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .episode-title {
    font-size: 13px;
    color: var(--weeb-fg-secondary);
    line-height: 1.35;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Numeral step: an episode number and an air date are both measured values. */
  .episode-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 10px;
    margin-top: auto;
    font-family: var(--weeb-font-mono);
    font-size: 12px;
    color: var(--weeb-fg-muted);
  }

  @media (max-width: 767px) {
    .calendar-popover {
      width: 350px;
      max-width: calc(100vw - 32px);
    }
    .episode-art {
      width: 76px;
    }
  }
</style>
