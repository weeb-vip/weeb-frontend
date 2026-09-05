<script lang="ts" module>
  /**
   * 440 / 560 / 720. There used to be no size API at all: the card was 440px
   * and the escape hatch was silently dead -- `:global(.weeb-modal-card)`
   * declares `max-width` at the same specificity a utility class does and wins
   * on order, so `className="max-w-2xl"` measured 440px and the image cropper
   * was squeezed into a dialog meant for a sign-in form.
   */
  export type ModalSize = 'sm' | 'md' | 'lg';
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { dialogSurface } from '$lib/actions/dialog';

  let {
    isOpen = false,
    showCloseButton = true,
    backdropCloseable = true,
    /** `sm` is a form; `md` a list; `lg` something you work inside, like the cropper. */
    size = 'sm',
    className = '',
    /** Asked to dismiss -- by the close button, the backdrop, or Escape. */
    onClose,
    children,
  }: {
    isOpen?: boolean;
    showCloseButton?: boolean;
    backdropCloseable?: boolean;
    size?: ModalSize;
    className?: string;
    onClose?: () => void;
    children?: Snippet;
  } = $props();

  // The portal appends to <body>, so nothing renders until we are on the
  // client and there is a body to append to.
  let mounted = $state(false);

  $effect(() => {
    mounted = true;
  });

  function closeModal() {
    onClose?.();
  }

  function handleBackdropClick(e: MouseEvent) {
    if (backdropCloseable && e.target === e.currentTarget) {
      closeModal();
    }
  }
</script>

{#if isOpen && mounted}
  <!-- Backdrop is purely presentational; click-to-dismiss has a keyboard
       equivalent via the Escape handling inside `dialogSurface`. That action is
       the portal, the focus trap, the Escape key and the page pin -- the same
       four MobileDrawer gets, from the same place. -->
  <div
    use:dialogSurface={{ onClose: closeModal }}
    class="weeb-overlay-backdrop weeb-modal-backdrop"
    onclick={handleBackdropClick}
    role="presentation"
  >
    <div class="weeb-modal-container">
      <div
        class="weeb-modal-card weeb-floating weeb-floating--dialog weeb-modal-card--{size} {className}"
        tabindex="-1"
        role="dialog"
        aria-modal="true"
        aria-label="Dialog"
      >
        {#if showCloseButton}
          <button type="button" class="weeb-modal-close" onclick={closeModal} aria-label="Close modal">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        {/if}
        {@render children?.()}
      </div>
    </div>
  </div>
{/if}

<style>
  /* Global styles required for portal - elements are moved to document.body.
     The scrim, blur and inset come from `.weeb-overlay-backdrop`. */
  :global(.weeb-modal-backdrop) {
    z-index: var(--weeb-z-modal);
    animation: weeb-modal-fadeIn 0.2s ease;
  }

  /* No layer of its own: it is a child of the backdrop, which already IS the
     modal layer, and the 201 it used to carry said otherwise for no reason. */
  :global(.weeb-modal-container) {
    position: fixed;
    inset: 0;
    overflow-y: auto;
    display: flex;
    min-height: 100%;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  /* Ground, border, radius and shadow all come from `.weeb-floating`; the
     dialog modifier is what keeps the card on --weeb-bg-elevated, so the
     --weeb-surface form fields inside it stay visible. What is left here is
     the card's own geometry. */
  :global(.weeb-modal-card) {
    position: relative;
    width: 100%;
    animation: weeb-modal-slideUp 0.25s ease;
  }

  :global(.weeb-modal-card--sm) { max-width: 440px; }
  :global(.weeb-modal-card--md) { max-width: 560px; }
  :global(.weeb-modal-card--lg) { max-width: 720px; }

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
    border-radius: var(--weeb-radius);
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
    /* Compounded with `.weeb-floating` deliberately: the recipe lives in a
       stylesheet whose load order relative to this component's chunk is not
       guaranteed, and a media query buys no specificity. */
    :global(.weeb-modal-card.weeb-floating) {
      max-width: 100%;
      border-radius: var(--weeb-radius-lg) var(--weeb-radius-lg) 0 0;
      align-self: flex-end;
      margin-top: auto;
    }
    :global(.weeb-modal-container) {
      align-items: flex-end;
      padding: 0;
    }
  }
</style>
