<script lang="ts">
  import SafeImage from './SafeImage.svelte';
  import { GetImageFromAnime, getYearUTC } from '../../services/utils';

  export let item: any;
  export let onClick: () => void;
</script>

<li
  class="flex items-center gap-3 px-4 py-2.5 border-b border-weeb-border bg-transparent cursor-pointer transition-colors duration-150 hover:bg-weeb-surface last:border-b-0 group"
  data-autocomplete-item
  on:click={onClick}
  on:keypress={(e) => { if (e.key === 'Enter') onClick(); }}
  role="option"
  aria-selected="false"
  tabindex="0"
>
  <div class="flex-shrink-0 rounded-md overflow-hidden" style="width: 37px; height: 56px;">
    <SafeImage
      src={GetImageFromAnime(item)}
      alt={item.title_en || item.name || ''}
      fallbackSrc="/assets/not found.jpg"
      className="!w-full !h-full"
      style="width: 37px; height: 56px; min-width: 37px; min-height: 56px;"
    />
  </div>
  <div class="flex-1 min-w-0 flex flex-col justify-center">
    <span class="text-sm font-medium text-weeb-fg whitespace-nowrap overflow-hidden text-ellipsis group-hover:text-weeb-accent transition-colors">
      {item.title_en || ''}
    </span>
    <span class="text-xs text-weeb-fg-muted">
      {getYearUTC(item.start_date)}
    </span>
  </div>
</li>
