<script lang="ts">
  let {
    tags = [],
    className = '',
    /** Pixels per second, so a long tag list scrolls at the same pace as a short one. */
    scrollSpeed = 50,
  }: {
    tags?: string[];
    className?: string;
    scrollSpeed?: number;
  } = $props();

  let containerRef = $state<HTMLDivElement | null>(null);
  let contentRef = $state<HTMLDivElement | null>(null);
  let isOverflowing = $state(false);
  let isHovered = $state(false);
  let animationDuration = $state(3);

  function checkOverflow() {
    if (!containerRef || !contentRef) return;

    const containerWidth = containerRef.offsetWidth;
    const contentWidth = contentRef.scrollWidth;

    isOverflowing = contentWidth > containerWidth;

    if (isOverflowing) {
      // Scroll distance is the content plus the 2rem gap the keyframes translate by.
      animationDuration = (contentWidth + 32) / scrollSpeed;
    }
  }

  // Re-measures on mount, whenever the tags change, and on resize. The
  // timeouts give layout a frame to settle before offsetWidth is read.
  $effect(() => {
    void tags;
    void scrollSpeed;
    if (!containerRef || !contentRef) return;

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
     marquee animation; the tags themselves stay visible and accessible. -->
<div
  bind:this={containerRef}
  class="overflow-hidden whitespace-nowrap relative {className}"
  role="presentation"
  onmouseenter={() => (isHovered = true)}
  onmouseleave={() => (isHovered = false)}
>
  <!-- Static content with gradient fade -->
  <div
    bind:this={contentRef}
    class="inline-block transition-opacity duration-200 {isOverflowing && isHovered ? 'opacity-0' : 'opacity-100'}"
  >
    {#if tags && tags.length > 0}
      {#each tags as tag}
        <span class="text-xs px-1.5 py-0.5 bg-weeb-surface text-weeb-fg-secondary rounded inline-block">{tag}</span>{' '}
      {/each}
    {:else}
      <span class="text-xs px-1.5 py-0.5 bg-weeb-surface text-weeb-fg-muted rounded inline-block">
        No tags
      </span>
    {/if}
  </div>

  <!-- Gradient fade (only when not hovered and overflowing) -->
  {#if isOverflowing && !isHovered}
    <span class="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-weeb-surface to-transparent"></span>
  {/if}

  <!-- Scrolling content (only shown on hover if overflowing) -->
  {#if isOverflowing}
    <div
      class="absolute top-0 left-0 inline-block whitespace-nowrap transition-opacity duration-200 {isHovered ? 'opacity-100 animate-scroll' : 'opacity-0'}"
      style="--scroll-duration: {animationDuration}s;"
    >
      {#each tags as tag}
        <span class="text-xs px-1.5 py-0.5 bg-weeb-surface text-weeb-fg-secondary rounded inline-block">{tag}</span>{' '}
      {/each}
    </div>
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
