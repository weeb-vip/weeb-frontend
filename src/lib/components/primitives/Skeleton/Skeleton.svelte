<script lang="ts">
  /**
   * One placeholder box, one pulse. Every skeleton in the app is a stack of
   * these -- there is no second shimmer keyframe anywhere.
   *
   * Presentational -- no bloc.
   */
  let {
    className = '',
    /**
     * A design-system radius. Left off, the box keeps Tailwind's `rounded`,
     * which is what the callers that pass their own `rounded-*` in `className`
     * rely on -- an inline radius would win over those.
     */
    radius = undefined,
  }: {
    className?: string;
    radius?: 'sm' | 'md' | 'lg' | 'full';
  } = $props();

  const RADII = {
    sm: 'var(--weeb-radius-sm)',
    md: 'var(--weeb-radius)',
    lg: 'var(--weeb-radius-lg)',
    full: 'var(--weeb-radius-full)',
  };
</script>

<div
  class="animate-pulse bg-weeb-surface {radius ? '' : 'rounded'} {className}"
  style={radius ? `border-radius: ${RADII[radius]};` : undefined}
></div>
