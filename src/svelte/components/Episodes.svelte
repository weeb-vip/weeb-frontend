<script lang="ts">
  import { format, isDate } from 'date-fns';

  export let episodes: any[];
  export let broadcast: string | null = null;

  // Sort episodes by episode number
  $: sortedEpisodes = episodes ? [...episodes].sort((a, b) => a.episodeNumber - b.episodeNumber) : [];

  function parseAirTime(airDate: string, broadcast: string): Date | null {
    if (!airDate) return null;
    try {
      // For now, just use the airDate directly since we'd need to import the parseAirTime utility
      return new Date(airDate);
    } catch {
      return null;
    }
  }

  function formatAirdate(episode: any): string {
    if (!episode.airDate) return "TBA";

    const airdate = parseAirTime(episode.airDate, (broadcast && broadcast.toLowerCase() !== "unknown") ? broadcast : "CST");
    return airdate && isDate(airdate) ? format(airdate, 'dd MMM yyyy') : "TBA";
  }

  function isAired(episode: any): boolean {
    if (!episode.airDate) return false;
    const airdate = new Date(episode.airDate);
    return airdate < new Date();
  }

  function isFuture(episode: any): boolean {
    if (!episode.airDate) return true;
    const airdate = new Date(episode.airDate);
    return airdate > new Date();
  }
</script>

<div class="ep-section">
  <div class="ep-list">
    {#each sortedEpisodes as episode (episode.id)}
      <div class="ep-row" class:ep-row--aired={isAired(episode)} class:ep-row--future={isFuture(episode)}>
        <div class="ep-num">{episode.episodeNumber}</div>
        <div class="ep-info">
          <div class="ep-title">{episode.titleEn || "TBA"}</div>
          {#if episode.titleJp && episode.titleJp !== episode.titleEn}
            <div class="ep-sub">{episode.titleJp}</div>
          {/if}
        </div>
        <div class="ep-date">{formatAirdate(episode)}</div>
      </div>
    {/each}
  </div>
</div>

<style>
  .ep-section {
    margin-bottom: 0;
  }

  .ep-list {
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius-lg, 12px);
    overflow: hidden;
    max-height: 520px;
    overflow-y: auto;
  }

  .ep-list::-webkit-scrollbar {
    width: 6px;
  }

  .ep-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .ep-list::-webkit-scrollbar-thumb {
    background: var(--weeb-border);
    border-radius: 3px;
  }

  .ep-row {
    display: grid;
    grid-template-columns: 48px 1fr 110px;
    align-items: center;
    padding: 14px 20px;
    border-bottom: 1px solid var(--weeb-border);
    transition: background 0.1s;
    cursor: pointer;
  }

  .ep-row:last-child {
    border-bottom: none;
  }

  .ep-row:hover {
    background: var(--weeb-surface);
  }

  .ep-num {
    font-family: var(--weeb-font-mono);
    font-size: 13px;
    font-weight: 700;
    color: var(--weeb-accent);
  }

  .ep-info {
    min-width: 0;
  }

  .ep-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--weeb-fg);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ep-sub {
    font-size: 12px;
    color: var(--weeb-fg-muted);
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ep-date {
    font-family: var(--weeb-font-mono);
    font-size: 12px;
    color: var(--weeb-fg-muted);
    text-align: right;
  }

  .ep-row--future .ep-title {
    color: var(--weeb-fg-secondary);
  }

  .ep-row--future .ep-num {
    opacity: 0.5;
  }

  /* Mobile */
  @media (max-width: 480px) {
    .ep-row {
      grid-template-columns: 36px 1fr 80px;
      padding: 12px 14px;
    }

    .ep-num {
      font-size: 12px;
    }

    .ep-title {
      font-size: 13px;
    }

    .ep-date {
      font-size: 11px;
    }

    .ep-list {
      max-height: 400px;
    }
  }
</style>
