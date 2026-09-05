<script lang="ts">
  import { anchoredPosition } from '../actions/anchoredPosition';
  import { clickOutside } from '../actions/clickOutside';

  /**
   * When the next episode airs, and nothing else.
   *
   * This panel used to carry the ranking and a details list as well, both of
   * which the quick-info bar immediately below already shows. A panel of glass
   * over the artwork is expensive; it has to earn its place with something the
   * page does not already say.
   *
   * Presentational -- no bloc. The timing is resolved once by the page, through
   * the same helper the homepage banner uses, so the two cannot disagree about
   * the same episode.
   */
  let {
    /** "Airing now" / "Recently aired" / "Next episode". */
    label,
    /** "3h", "45m", "12m left" -- or empty when it is further out than a day. */
    countdown = '',
    episodeNumber = '',
    /** "Thu 6:40 PM" in the viewer's timezone. */
    localTime = '',
    /** The viewer's zone abbreviation, for the marker beside the time. */
    localZone = '',
    /** The raw slot the API recorded -- "Wednesdays at 01:29 (JST)". */
    broadcastSlot = null,
    open = false,
    onToggle,
    onClose,
  }: {
    label: string;
    countdown?: string;
    episodeNumber?: string;
    localTime?: string;
    localZone?: string;
    broadcastSlot?: string | null;
    /** Whether the broadcast-slot popover is showing. */
    open?: boolean;
    onToggle: () => void;
    onClose: () => void;
  } = $props();

  let triggerEl = $state<HTMLButtonElement | null>(null);
</script>

<aside class="hero-aside" aria-label="Broadcast schedule">
  <div class="hero-next">
    <span class="hero-next-label">{label}</span>
    {#if countdown}
      <span class="hero-next-countdown">{countdown}</span>
    {/if}
    {#if episodeNumber}
      <span class="hero-next-ep">EP {episodeNumber}</span>
    {/if}
    {#if localTime}
      <span class="hero-next-when">
        {localTime}{#if localZone}&nbsp;<span class="hero-next-zone">{localZone}</span>{/if}
      </span>
    {/if}

    <!-- The times above are the viewer's, converted from a Japanese broadcast
         slot. Anyone comparing against a Japanese schedule needs the original,
         and a reader in JST needs to know the conversion happened at all -- but
         neither wants a second timestamp on the panel permanently. -->
    {#if broadcastSlot}
      <button
        bind:this={triggerEl}
        type="button"
        class="hero-next-slot-toggle"
        aria-expanded={open}
        aria-controls="show-broadcast-slot"
        onclick={onToggle}
      >
        Broadcast time
      </button>
    {/if}
  </div>
</aside>

{#if open && broadcastSlot}
  <!-- Fixed and anchored to the trigger rather than laid out in the panel: the
       hero clips its own overflow, so an in-flow popover was cut off at the
       panel's edge. -->
  <div
    class="slot-popover"
    id="show-broadcast-slot"
    role="note"
    use:anchoredPosition={{ anchor: () => triggerEl, align: 'left', gap: 6, minWidth: 240 }}
    use:clickOutside={{ handler: onClose, ignore: () => triggerEl, enabled: open }}
  >
    <p class="slot-popover__slot">{broadcastSlot}</p>
    <p class="slot-popover__note">Times above are converted to your local timezone.</p>
  </div>
{/if}

<style>
  .hero-aside {
    flex: 0 0 auto;
    width: 320px;
    background: var(--weeb-panel-bg, var(--weeb-surface));
    backdrop-filter: var(--weeb-panel-blur);
    -webkit-backdrop-filter: var(--weeb-panel-blur);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius-lg, 12px);
    box-shadow: var(--weeb-shadow-card, 0 12px 32px oklch(0% 0 0 / 0.4));
    padding: 20px;
  }

  /* No trailing rule: the border and the padding under it existed to separate
     the schedule from the ranking beneath it, and that has moved to the
     quick-info bar. */
  .hero-next {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .hero-next-label {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--weeb-fg-secondary);
  }
  .hero-next-countdown {
    font-family: var(--weeb-font-mono);
    font-size: 20px;
    font-weight: 500;
    letter-spacing: 0.02em;
    color: var(--weeb-fg);
  }
  .hero-next-ep,
  .hero-next-when {
    font-family: var(--weeb-font-mono);
    font-size: 12px;
    letter-spacing: 0.02em;
    color: var(--weeb-fg-secondary);
  }
  .hero-next-zone {
    color: var(--weeb-fg-muted);
  }

  .hero-next-slot-toggle {
    align-self: flex-start;
    margin-top: 4px;
    padding: 0;
    background: none;
    border: none;
    font-family: inherit;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--weeb-accent-text);
    text-decoration: underline;
    text-decoration-color: color-mix(in oklch, var(--weeb-accent-text) 40%, transparent);
    text-underline-offset: 3px;
    cursor: pointer;
  }
  .hero-next-slot-toggle:hover,
  .hero-next-slot-toggle:focus-visible {
    text-decoration-color: currentColor;
  }

  .slot-popover {
    /* Fixed from the first frame, not only once the action has measured: as a
       static element it would land in the hero's flex row for a beat. */
    position: fixed;
    z-index: 95;
    max-width: 300px;
    padding: 10px 12px;
    background: var(--weeb-bg-elevated);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius, 8px);
    box-shadow: var(--weeb-shadow-dropdown);
  }
  .slot-popover__slot {
    font-family: var(--weeb-font-mono);
    font-size: 12px;
    color: var(--weeb-fg);
  }
  .slot-popover__note {
    margin-top: 4px;
    font-size: 11px;
    color: var(--weeb-fg-muted);
  }

  /* The schedule collapses from a stacked block to one line: the same
     information -- state, episode, air time, countdown -- read across instead
     of down. */
  @media (max-width: 1024px) {
    .hero-aside {
      width: auto;
      padding: 14px;
    }
    .hero-next {
      flex-direction: row;
      align-items: baseline;
      flex-wrap: wrap;
      gap: 8px;
    }
    .hero-next-countdown {
      font-size: 15px;
    }
    .hero-next-label {
      font-size: 11px;
      letter-spacing: 0.05em;
    }
    .hero-next-slot-toggle {
      margin-top: 0;
    }
  }
</style>
