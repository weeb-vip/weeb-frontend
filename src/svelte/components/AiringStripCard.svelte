<script lang="ts">
  import SafeImage from './SafeImage.svelte';
  import { analytics } from '../../utils/analytics';

  export let id: string;
  export let title: string;
  export let image: string;
  export let episodeText: string = '';
  export let timeText: string = '';
  export let localTime: string = '';
  export let isLive: boolean = false;
  export let currentEpisode: number = 0;
  export let totalEpisodes: number = 0;

  $: progress = totalEpisodes > 0 ? Math.min((currentEpisode / totalEpisodes) * 100, 100) : 0;
  $: hasProgress = currentEpisode > 0 && totalEpisodes > 0;
</script>

<a
  class="airing-card"
  href="/show/{id}"
  on:click={() => analytics.animeViewed(id, title)}
  on:mouseenter
  on:mouseleave
>
  <div class="airing-poster">
    <SafeImage
      src={image}
      alt={title}
      className="airing-poster-img"
      fallbackSrc="/assets/not found.jpg"
    />
  </div>
  <div class="airing-info">
    <div class="airing-title">{title}</div>
    {#if episodeText}
      <div class="airing-ep">{episodeText}</div>
    {/if}
    {#if localTime}
      <div class="airing-local-time">{localTime}</div>
    {/if}
    {#if hasProgress}
      <div class="airing-progress">
        <div class="progress-bar">
          <div class="progress-fill" style="width: {progress}%"></div>
        </div>
        <span class="progress-label">{currentEpisode}/{totalEpisodes} ep</span>
      </div>
    {/if}
    {#if timeText || isLive}
      <div class="airing-time">
        {#if isLive}<span class="live">LIVE</span>{/if}
        {timeText}
      </div>
    {/if}
  </div>
</a>

<style>
  .airing-card {
    flex-shrink: 0;
    width: 300px;
    display: flex;
    gap: 12px;
    padding: 14px;
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius, 8px);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    text-decoration: none;
    color: inherit;
  }
  .airing-card:hover {
    border-color: var(--weeb-accent);
    background: var(--weeb-surface-hover);
  }
  .airing-poster {
    width: 56px;
    height: 80px;
    border-radius: 6px;
    flex-shrink: 0;
    overflow: hidden;
    background: linear-gradient(135deg, oklch(28% 0.03 280), oklch(22% 0.025 300));
  }
  .airing-poster :global(.airing-poster-img),
  .airing-poster :global(.airing-poster-img img) {
    width: 56px;
    height: 80px;
    object-fit: cover;
    display: block;
  }
  .airing-info {
    flex: 1;
    min-width: 0;
  }
  .airing-title {
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .airing-ep {
    font-size: 12px;
    color: var(--weeb-fg-muted);
    margin-top: 4px;
  }
  .airing-local-time {
    font-size: 11px;
    color: var(--weeb-fg-secondary);
    margin-top: 3px;
    font-variant-numeric: tabular-nums;
  }
  .airing-progress {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
  }
  .progress-bar {
    flex: 1;
    height: 3px;
    background: var(--weeb-border);
    border-radius: 2px;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: var(--weeb-accent);
    border-radius: 2px;
    transition: width 0.3s ease;
  }
  .progress-label {
    font-size: 10px;
    color: var(--weeb-fg-muted);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .airing-time {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin-top: 8px;
    padding: 3px 8px;
    border-radius: 4px;
    background: oklch(55% 0.15 280 / 0.15);
    color: var(--weeb-accent);
    font-size: 11px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .live {
    color: var(--weeb-green);
    font-weight: 700;
  }

  @media (max-width: 768px) {
    .airing-card {
      width: 260px;
    }
  }
</style>
