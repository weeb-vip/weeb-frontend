<script lang="ts">
  import { onMount } from 'svelte';
  import Modal from './Modal.svelte';
  import LoginRegisterModal from './LoginRegisterModal.svelte';
  import { loginModalStore } from '../stores/auth';
  import { initializeQueryClient } from '../services/query-client';

  let isOpen = false;
  let isRegisterMode = false;
  let QueryClientProvider: any = null;
  let queryClient: any = null;
  let isClient = false;

  onMount(async () => {
    // Initialize TanStack Query
    try {
      const { QueryClientProvider: QCP } = await import('@tanstack/svelte-query');
      QueryClientProvider = QCP;
      queryClient = initializeQueryClient();
      isClient = true;
    } catch (error) {
      console.warn('Failed to load TanStack Query:', error);
      isClient = true; // Still show modal without TanStack Query
    }

    // Subscribe to modal state
    const unsubscribe = loginModalStore.subscribe(state => {
      isOpen = state.isOpen;
      isRegisterMode = state.register;
    });

    // Listen for global modal events
    const handleOpenLogin = () => {
      loginModalStore.openLogin();
    };

    const handleOpenRegister = () => {
      loginModalStore.openRegister();
    };

    window.addEventListener('openLogin', handleOpenLogin);
    window.addEventListener('openRegister', handleOpenRegister);

    return () => {
      unsubscribe();
      window.removeEventListener('openLogin', handleOpenLogin);
      window.removeEventListener('openRegister', handleOpenRegister);
    };
  });

  function closeModal() {
    loginModalStore.close();
  }
</script>

{#if isClient}
  <Modal {isOpen} on:close={closeModal}>
    {#if QueryClientProvider && queryClient}
      <svelte:component this={QueryClientProvider} client={queryClient}>
        <LoginRegisterModal closeFn={closeModal} />
      </svelte:component>
    {:else}
      <!-- Fallback without TanStack Query -->
      <div class="w-[360px] sm:w-[400px] mx-auto p-8 sm:p-10">
        <h2 class="text-2xl font-bold mb-6 text-weeb-fg text-center">
          Login
        </h2>
        <div class="mb-4 flex items-center">
          <div class="w-full p-3 bg-weeb-amber/10 border border-weeb-amber/30 rounded-full">
            <p class="text-weeb-amber text-sm text-center">Loading authentication...</p>
          </div>
        </div>
      </div>
    {/if}
  </Modal>
{/if}