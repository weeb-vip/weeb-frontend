import type { ActionReturn } from 'svelte/action';

/** The only part of a `DOMRect` any of this needs. Plain data, so it is trivial to test. */
export interface AnchorRect {
  top: number;
  left: number;
  bottom: number;
  right: number;
  width: number;
  height: number;
}

export interface Viewport {
  width: number;
  height: number;
}

/** Which edge of the floating surface lines up with which edge of the anchor. */
export type Alignment = 'left' | 'right' | 'center';

export interface AnchoredPositionInput {
  /** @default 'left' */
  align?: Alignment;
  /** Vertical space between the anchor and the surface. @default 0 */
  gap?: number;
  /** How close to the viewport edge the surface may sit. @default 8 */
  margin?: number;
  /**
   * Floor for the surface's width. Also the width used for horizontal edge
   * clamping when the surface has not been measured yet — get this wrong and a
   * right-hand-edge menu opens off screen, which is exactly the bug each
   * hand-rolled copy of this maths had a slightly different fix for.
   */
  minWidth?: number;
  /** Measured (or estimated) width of the surface. @default max(anchor width, minWidth) */
  width?: number;
  /**
   * Measured (or estimated) height of the surface. Required for flipping: with
   * no height there is no way to know whether "below" fits.
   */
  height?: number;
  /** Flip above the anchor when below does not fit and above fits better. @default true */
  flip?: boolean;
  /** Make the surface at least as wide as its anchor, the way a `<select>` does. @default false */
  matchAnchorWidth?: boolean;
}

export interface AnchoredPosition {
  /** Viewport coordinates — the surface must be `position: fixed`. */
  top: number;
  left: number;
  /** What was used as the surface's width, and what to emit as `min-width`. */
  width: number;
  minWidth: number;
  /** Which side of the anchor it ended up on, for transform-origin / arrow styling. */
  placement: 'top' | 'bottom';
}

function readViewport(): Viewport {
  if (typeof window === 'undefined') {
    // No window (SSR, or a unit test that passes no viewport): clamp against
    // nothing rather than against zero, so the result is the unconstrained
    // "directly below the anchor" placement instead of nonsense.
    return { width: Number.POSITIVE_INFINITY, height: Number.POSITIVE_INFINITY };
  }
  return { width: window.innerWidth, height: window.innerHeight };
}

/**
 * The popover/menu placement maths, as a pure function.
 *
 * `AnimeStatusDropdown`, `AnimeCalendarPopover` and `Select` each measure their
 * trigger with `getBoundingClientRect()` and then compute `top`/`left`/
 * `min-width` by hand. The three copies drifted: only the dropdown flips above
 * the trigger, only `Select` honours a right alignment, only the popover
 * centres on mobile, and each uses a different viewport margin. Two of them
 * clamp `top` in an order that can still push the surface off the top of the
 * screen when it is taller than the viewport.
 *
 * Keeping the maths a plain function rather than only an action matters,
 * because one call site (`AnimeCalendarPopover`) computes the position in its
 * click handler — before the surface exists — and stores it in an exported
 * prop. An action alone cannot serve that; a function serves all three, and
 * {@link anchoredPosition} wraps it for the two that position a live element.
 *
 * Pass `viewport` explicitly to test the edge cases.
 */
export function computeAnchoredPosition(
  anchor: AnchorRect,
  input: AnchoredPositionInput = {},
  viewport: Viewport = readViewport()
): AnchoredPosition {
  const {
    align = 'left',
    gap = 0,
    margin = 8,
    minWidth = 0,
    matchAnchorWidth = false,
    flip = true
  } = input;

  const floor = matchAnchorWidth ? Math.max(anchor.width, minWidth) : minWidth;
  const width = Math.max(input.width ?? 0, floor, 0);
  const height = input.height;

  // Horizontal: align, then pull back inside the viewport. The left clamp is
  // applied last so a surface wider than the viewport overflows to the right,
  // where content is still reachable, rather than off the left edge.
  let left: number;
  if (align === 'right') {
    left = anchor.right - width;
  } else if (align === 'center') {
    left = anchor.left + anchor.width / 2 - width / 2;
  } else {
    left = anchor.left;
  }
  if (left + width > viewport.width - margin) {
    left = viewport.width - width - margin;
  }
  if (left < margin) {
    left = margin;
  }

  // Vertical: below by default, above when below genuinely does not fit and
  // above has more room.
  let top = anchor.bottom + gap;
  let placement: 'top' | 'bottom' = 'bottom';

  if (height !== undefined) {
    const spaceBelow = viewport.height - anchor.bottom - gap - margin;
    const spaceAbove = anchor.top - gap - margin;
    if (flip && height > spaceBelow && spaceAbove > spaceBelow) {
      top = anchor.top - height - gap;
      placement = 'top';
    }
    // min before max: for a surface taller than the viewport the top edge wins,
    // so the start of the list is always visible and the surface scrolls.
    top = Math.min(top, viewport.height - height - margin);
    top = Math.max(top, margin);
  }

  return { top, left, width, minWidth: Math.max(floor, 0), placement };
}

/** `style` string for a call site that interpolates the position itself rather than using the action. */
export function anchoredPositionStyle(position: AnchoredPosition): string {
  return `position: fixed; top: ${position.top}px; left: ${position.left}px; min-width: ${position.minWidth}px;`;
}

export interface AnchoredPositionOptions extends AnchoredPositionInput {
  /** The trigger to hang off. A getter is allowed for anchors bound after this element. */
  anchor: Element | null | undefined | (() => Element | null | undefined);
  /**
   * Measure the surface itself instead of trusting `width`/`height` estimates.
   * This is why the action is worth having: the hand-rolled copies hard-code
   * "the menu is 280px tall, 200px wide" and misplace themselves whenever that
   * stops being true. @default true
   */
  measure?: boolean;
  /** Receives every computed position, for a call site that also wants the numbers. */
  onPosition?: (position: AnchoredPosition) => void;
}

/**
 * Positions a portalled, `position: fixed` surface against its trigger, and
 * keeps it there while the page scrolls or resizes.
 *
 * Collapses the third piece the three copies shared: a scroll/resize
 * recalculation (`Select` has one; the other two do not, so their menus drift
 * away from their triggers) and the listener teardown that goes with it.
 *
 * ```svelte
 * <div use:anchoredPosition={{ anchor: triggerEl, align, gap: 6, matchAnchorWidth: true }}>
 * ```
 */
export function anchoredPosition(
  node: HTMLElement,
  options: AnchoredPositionOptions
): ActionReturn<AnchoredPositionOptions> {
  if (typeof window === 'undefined') {
    return {};
  }

  let current = options;
  let frame = 0;

  function resolveAnchor(): Element | null {
    const anchor = typeof current.anchor === 'function' ? current.anchor() : current.anchor;
    return anchor ?? null;
  }

  function apply() {
    const anchor = resolveAnchor();
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const measure = current.measure !== false;
    const position = computeAnchoredPosition(
      rect,
      {
        ...current,
        // Measure the surface for real; fall back to whatever estimate the call
        // site supplied while it is still zero-sized.
        width: measure ? node.offsetWidth || current.width : current.width,
        height: measure ? node.offsetHeight || current.height : current.height
      },
      { width: window.innerWidth, height: window.innerHeight }
    );

    node.style.position = 'fixed';
    node.style.top = `${position.top}px`;
    node.style.left = `${position.left}px`;
    if (position.minWidth > 0) {
      node.style.minWidth = `${position.minWidth}px`;
    }
    node.dataset.placement = position.placement;
    current.onPosition?.(position);
  }

  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      apply();
    });
  }

  apply();
  // A second pass once the surface has laid out: the first apply() runs before
  // the browser has given a freshly mounted menu its height, so flipping would
  // otherwise always decide on a stale measurement.
  schedule();

  // Capture, so a menu anchored inside a scrolling filter row also follows that
  // row -- scroll does not bubble.
  window.addEventListener('scroll', schedule, { capture: true, passive: true });
  window.addEventListener('resize', schedule, { passive: true });

  return {
    update(next: AnchoredPositionOptions) {
      current = next;
      apply();
    },
    destroy() {
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    }
  };
}
