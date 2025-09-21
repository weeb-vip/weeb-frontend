<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { slide } from 'svelte/transition';
  import { navigateWithTransition } from '../../utils/astro-navigation';
  import { GetImageFromAnime } from '../../services/utils';
  import SafeImage from './SafeImage.svelte';
  import type { ToastData } from '../stores/toast';
  import '@fortawesome/fontawesome-free/css/all.min.css';

  export let toast: ToastData;
  export let onClose: (id: string) => void;

  let isVisible = true;
  let progress = 100;
  let progressInterval: NodeJS.Timeout;

  $: typeStyles = {
    warning: 'bg-orange-500',
    info: 'bg-blue-500',
    success: 'bg-green-500'
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
    class="fixed top-20 right-4 z-50 w-80 bg-white dark:bg-gray-800 shadow-lg rounded-lg ring-1 ring-black ring-opacity-5 dark:ring-gray-600 overflow-hidden"
    in:slide={{ duration: 300 }}
    out:slide={{ duration: 300 }}
  >
    <!-- Progress bar -->
    <div class="absolute top-0 left-0 h-1 bg-gray-200 dark:bg-gray-700 w-full">
      <div
        class="h-full transition-all duration-75 ease-linear {typeStyles[toast.type]}"
        style="width: {progress}%"
      ></div>
    </div>

    <div class="p-4">
      <div class="flex items-start">
        <!-- Icon -->
        <div class="flex-shrink-0">
          <i class="fas {iconClass[toast.type]} text-lg {toast.type === 'warning' ? 'text-orange-500' : toast.type === 'info' ? 'text-blue-500' : 'text-green-500'}"></i>
        </div>

        <!-- Content -->
        <div class="ml-3 flex-1 min-w-0">
          <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {toast.title}
          </p>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400 overflow-hidden" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.4;">
            {toast.message}
          </p>

          <!-- Anime info if present -->
          {#if toast.anime}
            <div
              class="mt-3 flex items-center space-x-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded-md transition-colors"
              on:click={handleAnimeClick}
              on:keydown={(e) => e.key === 'Enter' && handleAnimeClick()}
              role="button"
              tabindex="0"
            >
              <div class="flex-shrink-0">
                <SafeImage
                  src={GetImageFromAnime(toast.anime)}
                  alt={toast.anime.titleEn || toast.anime.titleJp || 'Anime'}
                  className="w-8 h-8 rounded object-cover"
                  fallbackClassName="w-8 h-8 rounded bg-gray-300 dark:bg-gray-600 flex items-center justify-center"
                />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {toast.anime.titleEn || toast.anime.titleJp}
                </p>
                <div class="flex items-center text-xs text-gray-500 dark:text-gray-400">
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
            class="bg-white dark:bg-gray-800 rounded-md inline-flex text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            on:click={handleClose}
          >
            <span class="sr-only">Close</span>
            <i class="fas fa-times text-sm"></i>
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}