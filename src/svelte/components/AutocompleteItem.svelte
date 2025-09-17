<script lang="ts">
  import { format, isValid } from 'date-fns';
  import SafeImage from './SafeImage.svelte';
  import { getImageFromAnime } from '../utils/image';

  export let item: any;
  export let onClick: () => void;

  function formatDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
      // Normalize the date string for Safari compatibility
      let normalizedDate = dateStr.toString();
      // Remove microseconds and fix timezone format for Safari
      normalizedDate = normalizedDate.replace(/(\.\d{6})?\s(\+\d{2}:\d{2})$/, '$2');
      const date = new Date(normalizedDate);
      if (isValid(date)) {
        return format(date, 'yyyy');
      }
    } catch {
      return '';
    }
    return '';
  }
</script>

<li
  class="aa-Item px-4 py-3 flex flex-row hover:bg-gray-50/80 dark:hover:bg-gray-700/60 transition-all duration-200 cursor-pointer group border-b border-gray-100 dark:border-gray-700 last:border-b-0"
  on:click={onClick}
  on:keypress={(e) => { if (e.key === 'Enter') onClick(); }}
  role="option"
  aria-selected="false"
  tabindex="0"
>
  <div class="flex-shrink-0 mr-3">
    <SafeImage
      src={getImageFromAnime(item)}
      alt={item.title_en || item.name || ''}
      fallbackSrc="/assets/not found.jpg"
      style="height: 50px"
      className="aspect-2/3 rounded-md shadow-sm group-hover:shadow-md transition-shadow duration-200 object-cover"
      width="33"
      height="50"
    />
  </div>
  <div class="flex flex-col justify-center flex-1 min-w-0">
    <span class="text-gray-900 dark:text-gray-100 font-medium text-sm truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
      {item.title_en || ''}
    </span>
    <span class="text-gray-500 dark:text-gray-400 text-xs">
      {formatDate(item.start_date)}
    </span>
  </div>
</li>