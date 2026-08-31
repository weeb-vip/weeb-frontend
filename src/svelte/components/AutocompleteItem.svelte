<script lang="ts">
  import SafeImage from './SafeImage.svelte';
  import { GetImageFromAnime, getYearUTC } from '../../services/utils';
  import { readableWorkType } from '../../utils/workDisplay';

  export let item: any;
  export let onClick: () => void;
  export let active = false;
  export let id: string | undefined = undefined;

  // Works come from a different index and are tagged at the source, so this
  // never has to infer which one a hit came from by sniffing its fields.
  $: isWork = item?.__kind === 'work';

  // SafeImage takes a record id and the CDN folder it lives in, and builds the
  // URL itself -- handing it a finished URL gets that URL encoded into another
  // one. Works are stored under works/; anime posters sit at the CDN root here.
  $: imageSrc = isWork ? (item?.id ?? '') : GetImageFromAnime(item);
  $: imagePath = isWork ? 'works' : '';
  // MyAnimeList's own host, used only if the cover has not reached the CDN.
  $: imageFallback = isWork && item?.image_url ? item.image_url : '/assets/not found.jpg';

  const readableType = readableWorkType;

  // Anime show a year alone; a work shows what kind of thing it is first,
  // because "Light novel" is the fact that distinguishes it from the anime
  // sitting a few rows above it under the same name.
  $: subtitle = isWork
    ? [readableType(item?.type), getYearUTC(item?.published_from)].filter(Boolean).join(' · ')
    : getYearUTC(item?.start_date);
</script>

<li
  class="flex items-center gap-3 px-4 py-2.5 border-b border-weeb-border cursor-pointer transition-colors duration-150 hover:bg-weeb-surface last:border-b-0 group"
  class:bg-weeb-surface={active}
  class:ac-item-active={active}
  data-autocomplete-item
  {id}
  on:click={onClick}
  on:keypress={(e) => { if (e.key === 'Enter') onClick(); }}
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
