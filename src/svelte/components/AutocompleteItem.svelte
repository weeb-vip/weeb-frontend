<script lang="ts">
  import SafeImage from './SafeImage.svelte';
  import { GetImageFromAnime, getYearUTC } from '../../services/utils';
  import { readableWorkType } from '../../utils/workDisplay';

  /**
   * Presentational -- no bloc. One row of the search panel: it renders a hit
   * and reports that it was chosen. Which row is highlighted, and what
   * choosing one does, belong to `AutocompleteAdvancedBloc`.
   */
  let {
    item,
    onClick,
    active = false,
    id = undefined
  }: {
    item: any;
    onClick: () => void;
    active?: boolean;
    id?: string | undefined;
  } = $props();

  // Works come from a different index and are tagged at the source, so this
  // never has to infer which one a hit came from by sniffing its fields.
  const isWork = $derived(item?.__kind === 'work');

  // SafeImage takes a record id and the CDN folder it lives in, and builds the
  // URL itself -- handing it a finished URL gets that URL encoded into another
  // one. Works are stored under works/; anime posters sit at the CDN root here.
  const imageSrc = $derived(isWork ? (item?.id ?? '') : GetImageFromAnime(item));
  const imagePath = $derived(isWork ? 'works' : '');
  // MyAnimeList's own host, used only if the cover has not reached the CDN.
  const imageFallback = $derived(
    isWork && item?.image_url ? item.image_url : '/assets/not found.jpg'
  );

  // Anime show a year alone; a work shows what kind of thing it is first,
  // because "Light novel" is the fact that distinguishes it from the anime
  // sitting a few rows above it under the same name.
  const subtitle = $derived(
    isWork
      ? [readableWorkType(item?.type), getYearUTC(item?.published_from)].filter(Boolean).join(' · ')
      : getYearUTC(item?.start_date)
  );
</script>

<li
  class="flex items-center gap-3 px-4 py-2.5 border-b border-weeb-border cursor-pointer transition-colors duration-150 hover:bg-weeb-surface last:border-b-0 group"
  class:bg-weeb-surface={active}
  class:ac-item-active={active}
  data-autocomplete-item
  {id}
  onclick={onClick}
  onkeypress={(e) => { if (e.key === 'Enter') onClick(); }}
  role="option"
  aria-selected={active}
  tabindex="-1"
>
  <div class="flex-shrink-0 rounded-md overflow-hidden" style="width: 37px; height: 56px;">
    <SafeImage
      src={imageSrc}
      path={imagePath}
      alt={item.title_en || item.title_jp || item.name || ''}
      fallbackSrc={imageFallback}
      className="!w-full !h-full"
      style="width: 37px; height: 56px; min-width: 37px; min-height: 56px;"
    />
  </div>
  <div class="flex-1 min-w-0 flex flex-col justify-center">
    <span
      class="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis group-hover:text-weeb-accent-text transition-colors"
      class:text-weeb-accent-text={active}
      class:text-weeb-fg={!active}
    >
      {item.title_en || item.title_jp || ''}
    </span>
    <span class="text-xs text-weeb-fg-muted">
      {subtitle}
    </span>
  </div>
</li>
