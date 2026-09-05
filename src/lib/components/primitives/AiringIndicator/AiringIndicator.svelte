<script lang="ts">
  import Chip from '$lib/components/primitives/Chip';

  /**
   * "This is on the air", drawn one way.
   *
   * It had four treatments and two colours: `PosterCard`'s green dot with a
   * glow, `ShowQuickInfo`'s green chip with a pulsing dot, `HeroAiringRail`'s
   * green dot beside the word "Now", and `AnimeCard`'s AMBER text with a
   * broadcast-tower icon. That last one is the reason this exists as a
   * component rather than a convention: amber already means "upcoming"
   * (`PosterCard`'s `.status-dot.upcoming`), so the palette said "not yet
   * airing" and "airing right now" in the same colour.
   *
   * One rule now, and it is the design system's own: green is airing, amber is
   * upcoming, and nothing else. One pulse -- on the airing dot, off under
   * prefers-reduced-motion -- because a pulse means "happening now" and
   * something that is merely scheduled must not move.
   *
   * `dot` is the bare marker for a card corner or the end of a row; `chip`
   * composes `Chip`, so it is the same pill as every other pill.
   *
   * Presentational -- no bloc. Whoever resolved the schedule says which it is.
   */
  let {
    state = 'airing',
    presentation = 'dot',
    /** Chip only. Defaults to the state's own name. */
    label = undefined,
    /** The dot pulses while airing; pass false where the motion would be noise. */
    pulse = true,
    /** Chip only: numerals in the mono face, for a countdown label. */
    mono = false,
    class: className = '',
  }: {
    state?: 'airing' | 'upcoming';
    presentation?: 'dot' | 'chip';
    label?: string | undefined;
    pulse?: boolean;
    mono?: boolean;
    class?: string;
  } = $props();

  const airing = $derived(state === 'airing');
  const text = $derived(label ?? (airing ? 'Airing' : 'Upcoming'));
</script>

{#if presentation === 'chip'}
  <Chip tone={airing ? 'green' : 'amber'} {mono} class={className}>
    <span class="dot" class:is-airing={airing} class:pulse={airing && pulse} aria-hidden="true"></span>
    <span>{text}</span>
  </Chip>
{:else}
  <span
    class="dot dot--solo {className}"
    class:is-airing={airing}
    class:pulse={airing && pulse}
    role="img"
    aria-label={text}
    title={text}
  ></span>
{/if}

<style>
  .dot {
    width: 6px;
    height: 6px;
    border-radius: var(--weeb-radius-full);
    background: var(--weeb-amber);
    flex-shrink: 0;
    display: inline-block;
  }
  .dot.is-airing {
    background: var(--weeb-green);
  }

  /* On its own over cover art the dot needs to be found, so it runs a step
     larger and carries a halo of its own colour. Inside a chip the label
     already locates it. */
  .dot--solo {
    width: 8px;
    height: 8px;
  }
  .dot--solo.is-airing {
    box-shadow: 0 0 8px var(--weeb-green);
  }

  .dot.pulse {
    animation: airingPulse 2s ease-in-out infinite;
  }
  @keyframes airingPulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }
  /* A pulsing dot is decoration, and on an otherwise static page it is the only
     thing moving for anyone who has asked for less motion. */
  @media (prefers-reduced-motion: reduce) {
    .dot.pulse {
      animation: none;
    }
  }

  @media (max-width: 480px) {
    .dot--solo {
      width: 6px;
      height: 6px;
    }
  }
</style>
