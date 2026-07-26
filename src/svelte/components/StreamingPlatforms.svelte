<script lang="ts">
  import { isFeatureEnabled } from '../../utils/analytics';

  export let platforms: Array<{ platform: string; name?: string | null; url: string }> | null | undefined = undefined;

  const featureEnabled = typeof window !== 'undefined' && isFeatureEnabled('animeschedule-integration');

  const platformIcons: Record<string, string> = {
    crunchyroll: 'https://img.animeschedule.net/production/assets/public/img/streams/crunchyroll.png',
    netflix: 'https://img.animeschedule.net/production/assets/public/img/streams/netflix.png',
    hidive: 'https://img.animeschedule.net/production/assets/public/img/streams/hidive.png',
    amazon: 'https://img.animeschedule.net/production/assets/public/img/streams/amazon.png',
    hulu: 'https://img.animeschedule.net/production/assets/public/img/streams/hulu.png',
    apple: 'https://img.animeschedule.net/production/assets/public/img/streams/apple.png',
    youtube: 'https://img.animeschedule.net/production/assets/public/img/streams/youtube.png',
    bilibili: 'https://img.animeschedule.net/production/assets/public/img/streams/bilibili.png',
    'disney+': 'https://img.animeschedule.net/production/assets/public/img/streams/disneyplus.png',
  };

  function ensureUrl(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `https://${url}`;
  }
</script>

{#if featureEnabled && platforms && platforms.length > 0}
  <div class="streaming-platforms">
    <span class="label">Watch on</span>
    <div class="platforms-list">
      {#each platforms as platform}
        <a
          href={ensureUrl(platform.url)}
          target="_blank"
          rel="noopener noreferrer"
          class="platform-link"
          title={platform.name || platform.platform}
        >
          {#if platformIcons[platform.platform.toLowerCase()]}
            <img
              src={platformIcons[platform.platform.toLowerCase()]}
              alt={platform.name || platform.platform}
              class="platform-icon"
              loading="lazy"
            />
          {/if}
          <span class="platform-name">{platform.name || platform.platform}</span>
        </a>
      {/each}
    </div>
  </div>
{/if}

<style>
  .streaming-platforms {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 1rem;
  }

  .label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-secondary, #888);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .platforms-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .platform-link {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    border-radius: 0.375rem;
    background: var(--bg-secondary, #1a1a2e);
    color: var(--text-primary, #fff);
    text-decoration: none;
    font-size: 0.8125rem;
    transition: background 0.15s ease, transform 0.1s ease;
  }

  .platform-link:hover {
    background: var(--bg-hover, #2a2a4e);
    transform: translateY(-1px);
  }

  .platform-icon {
    width: 18px;
    height: 18px;
    object-fit: contain;
    border-radius: 2px;
  }

  .platform-name {
    white-space: nowrap;
  }
</style>
