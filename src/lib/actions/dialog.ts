/**
 * The dialog machinery, once.
 *
 * `Modal` and `MobileDrawer` are two presentations of the same thing: a surface
 * over the page that has to be portalled out of whatever clipped ancestor it
 * was declared in, hold focus, close on Escape, and pin the page behind it.
 * They used to be two independent implementations of all four -- two focus
 * traps to keep correct forever, and two spellings of the same backdrop.
 *
 * This is the behaviour half; `.weeb-overlay-backdrop` in design-tokens.css is
 * the CSS half. A presentation supplies the markup and nothing else.
 */

import type { ActionReturn } from 'svelte/action';

export interface ScrollLockPort {
  lock(): void;
  unlock(): void;
}

/**
 * Pinning the page behind a dialog.
 *
 * `overflow: hidden` alone does not hold on iOS Safari -- the page keeps
 * scrolling under the surface. Pinning the body and restoring the offset on
 * close is the only thing that works there, and it costs nothing elsewhere.
 *
 * Ref-counted at module scope, because dialogs overlap: opening the login modal
 * from the mobile drawer means both are mounted for as long as the drawer's
 * outro runs. With a lock per owner, the drawer's release would hand the page
 * back while the modal still held it -- and, worse, the modal would have saved
 * a scroll offset of 0 (the body was already pinned) and scrolled the reader to
 * the top on close. Only the first lock pins and only the last release restores.
 */
let lockDepth = 0;
let savedScrollY = 0;

function pin(): void {
  if (typeof document === 'undefined') return;
  if (lockDepth++ > 0) return;
  savedScrollY = window.scrollY;
  const style = document.body.style;
  style.position = 'fixed';
  style.top = `-${savedScrollY}px`;
  style.left = '0';
  style.right = '0';
  style.overflow = 'hidden';
}

function release(): void {
  if (typeof document === 'undefined' || lockDepth === 0) return;
  if (--lockDepth > 0) return;
  const style = document.body.style;
  style.position = '';
  style.top = '';
  style.left = '';
  style.right = '';
  style.overflow = '';
  window.scrollTo(0, savedScrollY);
}

/**
 * A handle on the shared page pin. Idempotent per owner -- locking twice counts
 * once -- so a caller cannot unbalance the shared count.
 *
 * A port because a story that renders an open drawer must not pin the Storybook
 * canvas: it passes `{ lock() {}, unlock() {} }` instead.
 */
export function createBodyScrollLock(): ScrollLockPort {
  let held = false;

  return {
    lock() {
      if (held) return;
      held = true;
      pin();
    },
    unlock() {
      if (!held) return;
      held = false;
      release();
    }
  };
}

export interface DialogSurfaceOptions {
  /** Asked to dismiss -- by Escape here, or by whatever the presentation wires up. */
  onClose?: () => void;
  /** Set false for a dialog that must be dismissed deliberately. */
  closeOnEscape?: boolean;
  /** Selector for the element to focus on open; the first focusable otherwise. */
  initialFocus?: string;
  /** `null` opts out of pinning the page (stories). Omit for the shared pin. */
  scrollLock?: ScrollLockPort | null;
}

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

function focusable(node: HTMLElement): HTMLElement[] {
  return Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement
  );
}

/**
 * Applied to a dialog's outermost node -- the backdrop. It portals that node to
 * <body>, pins the page, moves focus in, keeps Tab inside, closes on Escape,
 * and on teardown gives all four back.
 *
 * The node it is applied to is the trap boundary, so every focusable in the
 * panel is inside it; the panel keeps `role="dialog"` for the reader.
 */
export function dialogSurface(
  node: HTMLElement,
  options: DialogSurfaceOptions = {}
): ActionReturn<DialogSurfaceOptions> {
  let current = options;
  const previouslyFocused = document.activeElement as HTMLElement | null;
  const scrollLock = current.scrollLock === undefined ? createBodyScrollLock() : current.scrollLock;

  document.body.appendChild(node);
  scrollLock?.lock();

  // Deferred to the next frame: appendChild above moves the subtree, which
  // blurs whatever we focused and kicks focus back to <body>. Focusing after
  // the move lands is what makes it stick.
  const raf = requestAnimationFrame(() => {
    const named = current.initialFocus
      ? node.querySelector<HTMLElement>(current.initialFocus)
      : null;
    const target =
      named ?? focusable(node)[0] ?? node.querySelector<HTMLElement>('[role="dialog"]') ?? node;
    target.focus();
  });

  function onKeydown(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;
    const items = focusable(node);
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || !node.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function onDocumentKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    if (current.closeOnEscape === false) return;
    current.onClose?.();
  }

  node.addEventListener('keydown', onKeydown);
  document.addEventListener('keydown', onDocumentKeydown);

  return {
    update(next: DialogSurfaceOptions = {}) {
      current = next;
    },
    destroy() {
      cancelAnimationFrame(raf);
      node.removeEventListener('keydown', onKeydown);
      document.removeEventListener('keydown', onDocumentKeydown);
      scrollLock?.unlock();
      node.parentNode?.removeChild(node);
      // Back to whatever opened it -- but only if it is still on the page; a
      // sign-out navigates away, and a drawer's trigger unmounts with it.
      if (previouslyFocused?.isConnected) previouslyFocused.focus?.();
    }
  };
}
