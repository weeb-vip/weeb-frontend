<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { slide } from 'svelte/transition';
  import { navigateWithTransition } from '../../utils/astro-navigation';
  import { GetImageFromAnime } from '../../services/utils';
  import SafeImage from './SafeImage.svelte';
  import type { ToastData } from '../stores/toast';
  import '@fortawesome/fontawesome-free/css/all.min.css';
  import { preferencesStore, getAnimeTitle } from '../stores/preferences';

  export let toast: ToastData;
  export let onClose: (id: string) => void;

  let isVisible = true;
  let progress = 100;
  let progressInterval: NodeJS.Timeout;

  $: typeStyles = {
    warning: 'bg-weeb-amber',
    info: 'bg-weeb-accent',
    success: 'bg-weeb-green'
  };

  $: iconClass = {
    warning: 'fa-exclamation-triangle',
    info: 'fa-info-circle',
    success: 'fa-check-circle'
  };

  onMount(() => {
    const startTime = Date.now();
    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, (toast.duration! - elapsed) / toast.duration! * 100);
      progress = remaining;

      if (remaining > 0) {
        progressInterval = setTimeout(updateProgress, 16); // ~60fps
      } else {
        handleClose();
      }
    };

    progressInterval = setTimeout(updateProgress, 16);
  });

  onDestroy(() => {
    if (progressInterval) {
      clearTimeout(progressInterval);
    }
  });

  function handleClose() {
    isVisible = false;
    setTimeout(() => onClose(toast.id), 300); // Wait for exit animation
  }

  function handleAnimeClick() {
    if (toast.anime?.id) {
      navigateWithTransition(`/show/${toast.anime.id}`);
      handleClose();
    }
  }
</script>

{#if isVisible}
  <div
    class="fixed right-4 z-50 w-80 mobile-toast overflow-hidden"
    style="top: calc(5rem + env(safe-area-inset-top, 0px));"
    in:slide={{ duration: 300 }}
    out:slide={{ duration: 300 }}
  >
    <!-- Progress bar -->
    <div class="absolute top-0 left-0 h-1 bg-weeb-surface w-full">
      <div
        class="h-full transition-all duration-75 ease-linear {typeStyles[toast.type]}"
        style="width: {progress}%"
      ></div>
    </div>

    <div class="p-4">
      <div class="flex items-start">
        <!-- Icon -->
        <div class="flex-shrink-0">
          <i class="fas {iconClass[toast.type]} text-lg {toast.type === 'warning' ? 'text-weeb-amber' : toast.type === 'info' ? 'text-weeb-accent' : 'text-weeb-green'}"></i>
        </div>

        <!-- Content -->
        <div class="ml-3 flex-1 min-w-0">
          <p class="text-sm font-medium text-weeb-fg truncate">
            {toast.title}
          </p>
          <p class="mt-1 text-sm text-weeb-fg-muted overflow-hidden" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.4;">
            {toast.message}
          </p>

          <!-- Anime info if present -->
          {#if toast.anime}
            <div
              class="mt-3 flex items-center space-x-3 cursor-pointer hover:bg-weeb-surface-hover p-2 rounded-md transition-colors"
              on:click={handleAnimeClick}
              on:keydown={(e) => e.key === 'Enter' && handleAnimeClick()}
              role="button"
              tabindex="0"
            >
              <div class="flex-shrink-0">
                <SafeImage
                  src={GetImageFromAnime(toast.anime)}
                  alt={getAnimeTitle(toast.anime, $preferencesStore.titleLanguage)}
                  className="w-8 h-8 rounded object-cover"
                  fallbackClassName="w-8 h-8 rounded bg-weeb-surface-hover bg-weeb-surface-hover flex items-center justify-center"
                />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-weeb-fg truncate">
                  {getAnimeTitle(toast.anime, $preferencesStore.titleLanguage)}
                </p>
                <div class="flex items-center text-xs text-weeb-fg-muted">
                  <i class="fas fa-play mr-1"></i>
                  View Details
                </div>
              </div>
            </div>
          {/if}
        </div>

        <!-- Close button -->
        <div class="ml-4 flex-shrink-0">
          <button
            class="mobile-toast-close"
            on:click={handleClose}
          >
            <span class="sr-only">Close</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .mobile-toast {
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius, 8px);
    box-shadow: 0 8px 32px oklch(0% 0 0 / 0.4), 0 2px 8px oklch(0% 0 0 / 0.2);
    backdrop-filter: blur(20px);
  }
  .mobile-toast-close {
    background: none;
    border: none;
    color: var(--weeb-fg-muted);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: inline-flex;
    transition: color 0.15s, background 0.15s;
  }
  .mobile-toast-close:hover {
    color: var(--weeb-fg);
    background: var(--weeb-surface-hover);
  }
</style>