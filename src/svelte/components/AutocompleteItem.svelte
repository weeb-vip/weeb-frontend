<script lang="ts">
  import SafeImage from './SafeImage.svelte';
  import { GetImageFromAnime, getYearUTC } from '../../services/utils';
  import { getSafeImageUrl } from '../utils/image';

  export let item: any;
  export let onClick: () => void;
  export let active = false;
  export let id: string | undefined = undefined;

  // Works come from a different index and are tagged at the source, so this
  // never has to infer which one a hit came from by sniffing its fields.
  $: isWork = item?.__kind === 'work';

  // Works live under /works on the CDN, and image_url is MyAnimeList's own
  // host -- the fallback rather than the source, so a cover that has reached
  // the CDN is served from there.
  $: imageSrc = isWork ? getSafeImageUrl(item.id, 'works') : GetImageFromAnime(item);
  $: imageFallback = isWork && item?.image_url ? item.image_url : '/assets/not found.jpg';

  // MANGA -> Manga, LIGHT_NOVEL -> Light novel.
  function readableType(value: string | null | undefined): string {
    if (!value) return 'Work';
    const words = value.toLowerCase().split('_');
    return words[0].charAt(0).toUpperCase() + words[0].slice(1) +
      (words.length > 1 ? ' ' + words.slice(1).join(' ') : '');
  }

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
