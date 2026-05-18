<script lang="ts">
  import SafeImage from './SafeImage.svelte';
  import { GetImageFromAnime, getYearUTC } from '../../services/utils';

  export let item: any;
  export let onClick: () => void;
</script>

<li
  class="autocomplete-item"
  data-autocomplete-item
  on:click={onClick}
  on:keypress={(e) => { if (e.key === 'Enter') onClick(); }}
  role="option"
  aria-selected="false"
  tabindex="0"
>
  <div class="poster">
    <SafeImage
      src={GetImageFromAnime(item)}
      alt={item.title_en || item.name || ''}
      fallbackSrc="/assets/not found.jpg"
      className="poster-img"
      width="37"
      height="56"
    />
  </div>
  <div class="info">
    <span class="title">
      {item.title_en || ''}
    </span>
    <span class="subtitle">
      {getYearUTC(item.start_date)}
    </span>
  </div>
</li>

<style>
  .autocomplete-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    border-bottom: 1px solid var(--weeb-border);
    background: transparent;
    cursor: pointer;
    transition: background 0.15s;
  }

  .autocomplete-item:last-child {
    border-bottom: none;
  }

  .autocomplete-item:hover {
    background: var(--weeb-surface);
  }

  .poster {
    width: 37px;
    height: 56px;
    border-radius: 6px;
    overflow: hidden;
    flex-shrink: 0;
  }

  .poster :global(.poster-img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .title {
    font-size: 14px;
    font-weight: 500;
    color: var(--weeb-fg);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .autocomplete-item:hover .title {
    color: var(--weeb-accent);
  }

  .subtitle {
    font-size: 12px;
    color: var(--weeb-fg-muted);
  }
</style>
