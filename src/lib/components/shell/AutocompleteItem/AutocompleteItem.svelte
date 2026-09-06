<script lang="ts">
  import SafeImage from '$lib/components/primitives/SafeImage';
  import { autocompleteItemView } from './AutocompleteItem.logic';

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

  const view = $derived(autocompleteItemView(item));
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
      src={view.imageSrc}
      path={view.imagePath}
      alt={item.title_en || item.title_jp || item.name || ''}
      fallbackSrc={view.imageFallback}
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
      {view.subtitle}
    </span>
  </div>
</li>
