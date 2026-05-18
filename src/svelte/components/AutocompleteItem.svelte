<script lang="ts">
  import SafeImage from './SafeImage.svelte';
  import { GetImageFromAnime, getYearUTC } from '../../services/utils';

  export let item: any;
  export let onClick: () => void;
</script>

<li
  class="aa-Item px-4 py-3 flex flex-row hover:bg-weeb-bg-elevated/80 hover:bg-weeb-surface-hover/60 transition-all duration-200 cursor-pointer group border-b border-weeb-border border-weeb-border last:border-b-0"
  data-autocomplete-item
  on:click={onClick}
  on:keypress={(e) => { if (e.key === 'Enter') onClick(); }}
  role="option"
  aria-selected="false"
  tabindex="0"
>
  <div class="flex-shrink-0 mr-3">
    <SafeImage
      src={GetImageFromAnime(item)}
      alt={item.title_en || item.name || ''}
      fallbackSrc="/assets/not found.jpg"
      style="height: 50px"
      className="aspect-2/3 rounded-md shadow-sm group-hover:shadow-md transition-shadow duration-200 object-cover"
      width="33"
      height="50"
    />
  </div>
  <div class="flex flex-col justify-center flex-1 min-w-0">
    <span class="text-weeb-fg font-medium text-sm truncate group-hover:text-weeb-accent transition-colors duration-200">
      {item.title_en || ''}
    </span>
    <span class="text-weeb-fg-muted text-xs">
      {getYearUTC(item.start_date)}
    </span>
  </div>
</li>
