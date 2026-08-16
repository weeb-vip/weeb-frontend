<script lang="ts">
  import SafeImage from './SafeImage.svelte';
  import { GetImageSourcesFromAnime, getYearUTC } from '../../services/utils';

  export let item: any;
  export let onClick: () => void;
  export let active = false;
  export let id: string | undefined = undefined;
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
      sources={GetImageSourcesFromAnime(item)}
      alt={item.title_en || item.name || ''}
      fallbackSrc="/assets/not found.jpg"
      className="!w-full !h-full"
      style="width: 37px; height: 56px; min-width: 37px; min-height: 56px;"
    />
  </div>
  <div class="flex-1 min-w-0 flex flex-col justify-center">
    <span
      class="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis group-hover:text-weeb-accent transition-colors"
      class:text-weeb-accent={active}
      class:text-weeb-fg={!active}
    >
      {item.title_en || ''}
    </span>
    <span class="text-xs text-weeb-fg-muted">
      {getYearUTC(item.start_date)}
    </span>
  </div>
</li>
