<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import lottie, { type AnimationItem } from 'lottie-web';

  export let show: boolean = true;
  export let duration: number = 2000; // Show for 2 seconds

  let container: HTMLDivElement;
  let animation: AnimationItem | null = null;
  let visible = show;

  onMount(async () => {
    if (!container || !show) return;

    try {
      // Load the animation
      const response = await fetch('/assets/animations/splash-screen.json');
      const animationData = await response.json();

      animation = lottie.loadAnimation({
        container: container,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        animationData: animationData
      });

      // Hide splash screen after duration
      setTimeout(() => {
        visible = false;
      }, duration);

    } catch (error) {
      console.error('Error loading splash animation:', error);
      // Hide splash screen if animation fails to load
      setTimeout(() => {
        visible = false;
      }, 500);
    }
  });

  onDestroy(() => {
    if (animation) {
      animation.destroy();
    }
  });

  // Reactive statement to handle visibility changes
  $: if (!show) {
    visible = false;
  }
</script>

{#if visible}
  <div
    class="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-900 transition-opacity duration-500"
    class:opacity-0={!visible}
    class:opacity-100={visible}
  >
    <div class="flex flex-col items-center space-y-4">
      <!-- Lottie Animation Container -->
      <div
        bind:this={container}
        class="w-64 h-64 md:w-80 md:h-80"
      ></div>

      <!-- Fallback content if animation doesn't load -->
      <div class="text-center">
        <h1 class="text-2xl md:text-3xl font-bold text-white mb-2">WeebVIP</h1>
        <div class="flex space-x-1 justify-center">
          <div class="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          <div class="w-2 h-2 bg-white rounded-full animate-pulse" style="animation-delay: 0.2s;"></div>
          <div class="w-2 h-2 bg-white rounded-full animate-pulse" style="animation-delay: 0.4s;"></div>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .animate-pulse {
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.3;
    }
  }
</style>