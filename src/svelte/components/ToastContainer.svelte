<script lang="ts">
  import { onMount } from 'svelte';
  import Toast from './Toast.svelte';
  import MobileToast from './MobileToast.svelte';
  import { toastStore } from '../stores/toast';

  let isMobile = false;

  // Check if device is mobile
  onMount(() => {
    const checkMobile = () => {
      isMobile = window.innerWidth < 1024; // lg breakpoint
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  });

  // Subscribe to toast store
  $: ({ toasts, mobileQueue } = $toastStore);

  function handleRemoveToast(id: string) {
    toastStore.removeToast(id, isMobile);
  }
</script>

<!-- Mobile Toasts - Show one at a time with queue indicator -->
{#if isMobile}
  {#each toasts as toast (toast.id)}
    <MobileToast {toast} onClose={handleRemoveToast} />
  {/each}

  <!-- Queue indicator - show if there are more toasts waiting -->
  {#if mobileQueue.length > 1}
    <div class="fixed top-[8.5rem] right-4 z-40">
      <div class="bg-blue-500 text-white text-xs px-2 py-1 rounded-full shadow-lg">
        +{mobileQueue.length - 1} more
      </div>
    </div>
  {/if}
{/if}

<!-- Desktop Toasts - Show all simultaneously -->
{#if !isMobile}
  <div class="fixed top-28 right-6 z-30 flex flex-col items-end pointer-events-none">
    {#each toasts as toast (toast.id)}
      <div class="pointer-events-auto">
        <Toast {toast} onClose={handleRemoveToast} />
      </div>
    {/each}
  </div>
{/if}