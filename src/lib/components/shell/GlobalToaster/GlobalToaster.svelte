<script lang="ts">
  import { Toaster } from 'svelte-sonner';
  import { GlobalToasterBloc } from './GlobalToaster.bloc.svelte';

  /**
   * The app's one toast surface, mounted by the root layout. Everything else
   * calls `toast()` from svelte-sonner; this decides where the stack sits and
   * dresses it in the design tokens.
   */
  let { bloc = new GlobalToasterBloc() }: { bloc?: GlobalToasterBloc } = $props();

  // The media-query listener comes back out of the bloc as a teardown.
  $effect(() => bloc.watchViewport());
</script>

<!-- Global Toaster Configuration -->
<Toaster
  position={bloc.position}
  class="toaster-container"
  toastOptions={{
    duration: 6000,
    class: 'custom-toast',
    style: 'width: 20rem; max-width: 20rem; min-width: 20rem;'
  }}
/>

<style>
  /* The top of the layering scale. A toast is a report on something the
     reader just did, so it has to be readable over whatever is on top --
     including a dialog, which at 150 against the modal layer's 200 it was not. */
  :global(.toaster-container) {
    z-index: var(--weeb-z-toast) !important;
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

  /* ── Base toast (all toasts) ──
     The floating-surface recipe, restated rather than composed: sonner owns
     this element's class attribute and its own `[data-sonner-toast]` rules load
     after ours, so these four have to carry `!important`. They are the same
     four values `.weeb-floating` sets, read from the same tokens -- the shadow
     was a bespoke two-layer one and the radius disagreed with the custom
     toast's 14px. */
  :global([data-sonner-toast]) {
    background: var(--weeb-surface) !important;
    border: 1px solid var(--weeb-border) !important;
    border-radius: var(--weeb-radius-lg) !important;
    box-shadow: var(--weeb-shadow-dropdown) !important;
    color: var(--weeb-fg) !important;
    font-family: var(--weeb-font) !important;
    font-size: 0.875rem !important;
    padding: 12px 16px !important;
    backdrop-filter: blur(20px) !important;
    width: 22rem !important;
    max-width: 22rem !important;
    min-width: 22rem !important;
    transition: all 0.2s ease !important;
    word-wrap: break-word !important;
    overflow-wrap: break-word !important;
  }

  /* ── Custom anime toasts ── */
  /* Same surface as every other toast; only the padding differs, because the
     content is a 48px poster row rather than a line of text. The 14px radius
     that used to be here was the third radius in a stack of two. */
  :global([data-sonner-toast][data-custom="true"]) {
    padding: 10px 14px !important;
    width: 22rem !important;
    max-width: 22rem !important;
    min-width: 22rem !important;
  }

  /* ── Severity ──
     The shared severity recipe, expressed as a 3px rule down the leading edge
     rather than as a tint: the toast is already a card on its own ground, so a
     full tint would restate it. Same tokens as ErrorBanner's grounds and
     AnimeToast's indicator rings -- one palette across the whole stack. */

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
    border-radius: var(--weeb-radius) !important;
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
