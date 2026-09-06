<script lang="ts">
  import { hasScore, scoreText } from './Score.logic';

  /**
   * A rating, drawn one way.
   *
   * It was drawn five ways: `PosterCard.score-badge` (mono amber on a scrim,
   * radius 4, no star), `PosterCard.hover-score` (a `&#9733;` entity plus the
   * number, sans 600) -- the same value twice in the same card --
   * `ProfileMediaList.row-score` (a third `&#9733;`, mono, amber star + neutral
   * number), and `/search`'s `.list-score` (an inline SVG star, mono amber).
   * Four star glyphs for one idea.
   *
   * One glyph now, the filled SVG: a text `&#9733;` renders in whatever the
   * platform's emoji or symbol font decides, so the same markup was a thin
   * outline on one machine and a solid amber blob on another. Numbers are mono
   * and tabular in both variants, per the Mono Numeral Rule.
   *
   * Presentational -- no bloc.
   */
  let {
    value,
    /**
     * `badge` sits over cover art on its own scrim; `inline` sits in a text row
     * and takes the surrounding ground.
     */
    variant = 'inline',
    /** What is drawn when there is no score. `inline` only -- a badge just does not render. */
    placeholder = '—',
    class: className = '',
  }: {
    value: number | string | null | undefined;
    variant?: 'badge' | 'inline';
    placeholder?: string;
    class?: string;
  } = $props();

  const text = $derived(scoreText(value));
  const scored = $derived(hasScore(value));
</script>

{#if scored || variant === 'inline'}
  <span class="score score--{variant} {className}" class:no-score={!scored}>
    {#if scored}
      <svg class="score-star" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
      <span class="score-value">{text}</span>
    {:else}
      <span class="score-value">{placeholder}</span>
    {/if}
  </span>
{/if}

<style>
  .score {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-family: var(--weeb-font-mono);
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    color: var(--weeb-amber);
    flex-shrink: 0;
    line-height: 1;
  }

  .score-star {
    width: 1em;
    height: 1em;
    flex-shrink: 0;
  }

  /* Over cover art. Key art is routinely near-white, which is what --weeb-scrim
     exists for: at 0.7 alpha an amber number fell to 3.40:1 over it. */
  .score--badge {
    padding: 3px 7px;
    border-radius: var(--weeb-radius-sm);
    background: var(--weeb-scrim);
    backdrop-filter: blur(8px);
    font-size: 12px;
    font-weight: 700;
  }

  .score--inline {
    font-size: 13px;
  }
  /* Absent, not zero. The dash carries no colour and no weight so an unrated
     row does not read as a low score. */
  .score--inline.no-score {
    color: var(--weeb-fg-muted);
    font-weight: 400;
  }

  @media (max-width: 480px) {
    .score--badge {
      font-size: 12px;
      padding: 2px 5px;
    }
  }
</style>
