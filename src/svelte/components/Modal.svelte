<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy, tick } from 'svelte';

  export let isOpen = false;
  export let showCloseButton = true;
  export let backdropCloseable = true;
  export let className = '';

  const dispatch = createEventDispatcher();

  let mounted = false;

  onMount(() => {
    mounted = true;
  });

  function closeModal() {
    dispatch('close');
  }

  function handleBackdropClick(e: MouseEvent) {
    if (backdropCloseable && e.target === e.currentTarget) {
      closeModal();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && isOpen) {
      closeModal();
    }
  }

  // Prevent body scroll when modal is open
  $: if (typeof document !== 'undefined') {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  // Portal action - moves element to body level
  function portal(node: HTMLElement) {
    document.body.appendChild(node);

    return {
      destroy() {
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
      }
    };
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen && mounted}
  <div use:portal class="weeb-modal-backdrop" on:click={handleBackdropClick} role="dialog" aria-modal="true">
    <div class="weeb-modal-container">
      <div class="weeb-modal-card {className}" on:click|stopPropagation>
        {#if showCloseButton}
          <button type="button" class="weeb-modal-close" on:click={closeModal} aria-label="Close modal">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        {/if}
        <slot />
      </div>
    </div>
  </div>
{/if}

<style>
  /* Global styles required for portal - elements are moved to document.body */
  :global(.weeb-modal-backdrop) {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: oklch(0% 0 0 / 0.6);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    animation: weeb-modal-fadeIn 0.2s ease;
  }

  :global(.weeb-modal-container) {
    position: fixed;
    inset: 0;
    z-index: 201;
    overflow-y: auto;
    display: flex;
    min-height: 100%;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  :global(.weeb-modal-card) {
    position: relative;
    width: 100%;
    max-width: 440px;
    background: var(--weeb-bg-elevated);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius-lg, 12px);
    box-shadow: 0 8px 32px oklch(0% 0 0 / 0.4), 0 2px 8px oklch(0% 0 0 / 0.3);
    animation: weeb-modal-slideUp 0.25s ease;
  }

  :global(.weeb-modal-close) {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--weeb-radius, 8px);
    color: var(--weeb-fg-muted);
    cursor: pointer;
    transition: color 0.15s, background 0.15s, border-color 0.15s;
    z-index: 10;
    padding: 0;
  }

  :global(.weeb-modal-close:hover) {
    color: var(--weeb-fg);
    background: var(--weeb-surface);
    border-color: var(--weeb-border);
  }

  @keyframes -global-weeb-modal-fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes -global-weeb-modal-slideUp {
    from { opacity: 0; transform: translateY(8px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  @media (max-width: 480px) {
    :global(.weeb-modal-card) {
      max-width: 100%;
      border-radius: var(--weeb-radius-lg, 12px) var(--weeb-radius-lg, 12px) 0 0;
      align-self: flex-end;
      margin-top: auto;
    }
    :global(.weeb-modal-container) {
      align-items: flex-end;
      padding: 0;
    }
  }
</style>