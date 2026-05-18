<script>
  import { Toaster } from 'svelte-sonner';
  import { onMount } from 'svelte';

  let isMobile = false;
  let position = 'top-right';

  onMount(() => {
    const checkScreenSize = () => {
      isMobile = window.innerWidth <= 768;
      position = isMobile ? 'top-center' : 'top-right';
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);

    return () => {
      window.removeEventListener('resize', checkScreenSize);
    };
  });
</script>

<!-- Global Toaster Configuration -->
<Toaster
  {position}
  class="toaster-container"
  toastOptions={{
    duration: 6000,
    className: 'custom-toast',
    style: 'width: 20rem; max-width: 20rem; min-width: 20rem;'
  }}
/>

<style>
  :global(.toaster-container) {
    z-index: 150 !important;
  }

  /* Position below sticky nav */
  :global(.toaster-container) {
    top: calc(var(--weeb-nav-height, 60px) + 12px + env(safe-area-inset-top, 0px)) !important;
    right: 16px !important;
  }

  @media (max-width: 768px) {
    :global(.toaster-container) {
      top: calc(var(--weeb-nav-height, 60px) + 8px + env(safe-area-inset-top, 0px)) !important;
      right: 8px !important;
      left: 8px !important;
    }
  }

  /* ── Base toast (all toasts) ── */
  :global([data-sonner-toast]) {
    background: var(--weeb-surface) !important;
    border: 1px solid var(--weeb-border) !important;
    border-radius: var(--weeb-radius, 8px) !important;
    color: var(--weeb-fg) !important;
    font-family: var(--weeb-font) !important;
    font-size: 0.875rem !important;
    padding: 12px 16px !important;
    backdrop-filter: blur(20px) !important;
    box-shadow: 0 8px 32px oklch(0% 0 0 / 0.4), 0 2px 8px oklch(0% 0 0 / 0.2) !important;
    width: 22rem !important;
    max-width: 22rem !important;
    min-width: 22rem !important;
    transition: all 0.2s ease !important;
    word-wrap: break-word !important;
    overflow-wrap: break-word !important;
  }

  /* ── Custom anime toasts ── */
  :global([data-sonner-toast][data-custom="true"]) {
    background: var(--weeb-surface) !important;
    border: 1px solid var(--weeb-border) !important;
    border-radius: 14px !important;
    padding: 10px 14px !important;
    width: 22rem !important;
    max-width: 22rem !important;
    min-width: 22rem !important;
  }

  /* ── Error toast ── */
  :global([data-sonner-toast][data-type="error"]) {
    border-left: 3px solid var(--weeb-red) !important;
  }
  :global([data-sonner-toast][data-type="error"] [data-icon]) {
    color: var(--weeb-red) !important;
  }

  /* ── Success toast ── */
  :global([data-sonner-toast][data-type="success"]) {
    border-left: 3px solid var(--weeb-green) !important;
  }
  :global([data-sonner-toast][data-type="success"] [data-icon]) {
    color: var(--weeb-green) !important;
  }

  /* ── Warning toast ── */
  :global([data-sonner-toast][data-type="warning"]) {
    border-left: 3px solid var(--weeb-amber) !important;
  }

  /* ── Info toast ── */
  :global([data-sonner-toast][data-type="info"]) {
    border-left: 3px solid var(--weeb-accent) !important;
  }

  /* ── Toast title + description ── */
  :global([data-sonner-toast] [data-title]) {
    color: var(--weeb-fg) !important;
    font-weight: 600 !important;
    font-size: 0.875rem !important;
  }

  :global([data-sonner-toast] [data-description]) {
    color: var(--weeb-fg-secondary) !important;
    font-size: 0.8125rem !important;
    line-height: 1.4 !important;
    margin-top: 2px !important;
  }

  /* ── Toast close button ── */
  :global([data-sonner-toast] [data-close-button]) {
    background: var(--weeb-surface-hover) !important;
    border: 1px solid var(--weeb-border) !important;
    color: var(--weeb-fg-muted) !important;
  }
  :global([data-sonner-toast] [data-close-button]:hover) {
    background: var(--weeb-border) !important;
    color: var(--weeb-fg) !important;
  }

  /* ── Action button ── */
  :global([data-sonner-toast] button[data-button]) {
    background: var(--weeb-accent) !important;
    color: white !important;
    border: none !important;
    border-radius: var(--weeb-radius, 8px) !important;
    padding: 6px 14px !important;
    font-size: 0.8125rem !important;
    font-weight: 600 !important;
    cursor: pointer !important;
    margin-left: 8px !important;
    flex-shrink: 0 !important;
    transition: opacity 0.15s ease !important;
  }
  :global([data-sonner-toast] button[data-button]:hover) {
    opacity: 0.85 !important;
  }

  /* ── Mobile responsive ── */
  @media (max-width: 768px) {
    :global([data-sonner-toast]) {
      width: auto !important;
      max-width: calc(100vw - 16px) !important;
      min-width: auto !important;
      font-size: 0.8125rem !important;
      padding: 10px 12px !important;
    }
    :global([data-sonner-toast][data-custom="true"]) {
      width: auto !important;
      max-width: calc(100vw - 16px) !important;
      min-width: auto !important;
    }
  }
</style>
