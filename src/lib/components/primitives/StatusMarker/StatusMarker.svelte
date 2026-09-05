<script lang="ts">
  import { normalizeStatus, getStatusColor, getStatusLabel } from '$lib/utils/status';

  /**
   * "This is on your list", as a corner ribbon.
   *
   * The same fact used to be drawn two opposite ways off the same
   * `normalizeStatus`/`STATUS_LABELS` pair: `PosterCard`'s wordless 22px
   * colour-coded ribbon in the top-RIGHT, and `AnimeCard`'s accent-filled pill
   * reading "Watching" in the top-LEFT. The ribbon won because it ships to
   * twelve call sites, it never collides with the score badge opposite it, and
   * it does not put a word over the artwork.
   *
   * The glyph is the status: play for watching, tick for completed, cross for
   * dropped, pause for on hold, bookmark for planned. The colour is
   * `STATUS_COLORS`, so the ribbon, the profile row's status text and the
   * search page's badge cannot disagree about what green means.
   *
   * Sits in whatever positioned box the caller gives it -- a card owns where
   * its own corner is.
   *
   * Presentational -- no bloc.
   */
  let {
    status,
    class: className = '',
  }: {
    /** A raw list status; anything unrecognised renders nothing. */
    status: string | null | undefined;
    class?: string;
  } = $props();

  const normalized = $derived(normalizeStatus(status));
  const label = $derived(normalized ? getStatusLabel(normalized) : '');
</script>

{#if normalized}
  <span
    class="status-marker {className}"
    style="--marker-color: {getStatusColor(normalized)}"
    role="img"
    aria-label="On your list: {label}"
    title="On your list: {label}"
  >
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">
      {#if normalized === 'WATCHING'}
        <polygon points="5,3 19,12 5,21" />
      {:else if normalized === 'COMPLETED'}
        <polyline points="4,12 10,18 20,6" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
      {:else if normalized === 'DROPPED'}
        <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
        <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
      {:else if normalized === 'ONHOLD'}
        <rect x="5" y="4" width="4" height="16" rx="1" />
        <rect x="15" y="4" width="4" height="16" rx="1" />
      {:else}
        <path d="M5 3h14a1 1 0 011 1v16.5a.5.5 0 01-.8.4L12 16l-6.2 4.9A.5.5 0 015 20.5V4a1 1 0 011-1z" />
      {/if}
    </svg>
  </span>
{/if}

<style>
  .status-marker {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    padding: 4px 0 8px;
    background: var(--marker-color);
    color: white;
    font-size: 12px;
    opacity: 0.9;
    /* The notch at the foot is what makes it a ribbon rather than a tab. */
    clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%);
  }
</style>
