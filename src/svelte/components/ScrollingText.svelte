<script lang="ts">
  let {
    text,
    className = '',
    maxWidth = '100%',
    /** Pixels per second, so long and short titles scroll at the same pace. */
    scrollSpeed = 50,
  }: {
    text: string;
    className?: string;
    maxWidth?: string;
    scrollSpeed?: number;
  } = $props();

  let containerRef = $state<HTMLDivElement | null>(null);
  let measureRef = $state<HTMLSpanElement | null>(null);
  let isOverflowing = $state(false);
  let isHovered = $state(false);
  let animationDuration = $state(3);

  function checkOverflow() {
    if (!containerRef || !measureRef) return;

    const containerWidth = containerRef.offsetWidth;
    const textWidth = measureRef.scrollWidth;

    isOverflowing = textWidth > containerWidth;

    if (isOverflowing) {
      // Scroll distance is the text plus the 2rem gap the keyframes translate by.
      animationDuration = (textWidth + 32) / scrollSpeed;
    }
  }

  // Re-measures on mount, whenever the text changes, and on resize. The
  // timeouts give layout a frame to settle before offsetWidth is read.
  $effect(() => {
    void text;
    void scrollSpeed;
    if (!containerRef || !measureRef) return;

    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    const initialTimer = setTimeout(checkOverflow, 100);

    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(checkOverflow, 100);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(initialTimer);
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', handleResize);
    };
  });
</script>

<!-- Wrapper is presentational: hover handlers only toggle a decorative
     marquee animation; the text itself stays visible and accessible. -->
<div
  bind:this={containerRef}
  class="overflow-hidden whitespace-nowrap relative {className}"
  style="max-width: {maxWidth}"
  role="presentation"
  onmouseenter={() => (isHovered = true)}
  onmouseleave={() => (isHovered = false)}
>
  <!-- Hidden measurement element -->
  <span
    bind:this={measureRef}
    class="invisible absolute whitespace-nowrap"
  >
    {text}
  </span>

  <!-- Normal text with ellipsis -->
  <span
    class="inline-block truncate w-full transition-opacity duration-200 {isOverflowing && isHovered ? 'opacity-0' : 'opacity-100'}"
  >
    {text}
  </span>

  <!-- Scrolling text (only shown on hover if overflowing) -->
  {#if isOverflowing}
    <span
      class="absolute top-0 left-0 inline-block whitespace-nowrap transition-opacity duration-200 {isHovered ? 'opacity-100 animate-scroll' : 'opacity-0'}"
      style="--scroll-duration: {animationDuration}s;"
    >
      {text}
    </span>
  {/if}
</div>

<style>
  @keyframes scroll {
    0% {
      transform: translateX(0);
    }
    100% {
      transform: translateX(calc(-100% - 2rem));
    }
  }

  .animate-scroll {
    animation: scroll var(--scroll-duration) linear infinite;
  }
</style>