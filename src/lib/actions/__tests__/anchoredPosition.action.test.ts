/**
 * The `anchoredPosition` *action*. The placement maths it delegates to is
 * covered as a pure function in `anchoredPosition.test.ts` (node environment);
 * this file covers only the DOM wrapper — what it writes onto the node, how it
 * re-runs on scroll and resize, and that it removes both listeners and cancels
 * its pending frame on destroy. That teardown is the reason the action exists:
 * the hand-rolled copies it replaced left a scroll listener behind.
 *
 * jsdom does no layout, so `node.offsetWidth`/`offsetHeight` are permanently 0
 * and `getBoundingClientRect()` is all zeros. The anchor's rect is therefore
 * stubbed per test, and the surface's own size can only ever come from the
 * `width`/`height` estimates — the "measure the real surface" path is a browser
 * fact and belongs to the visual/e2e layer. Everything asserted below is a
 * number this file put in.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  anchoredPosition,
  computeAnchoredPosition,
  type AnchoredPosition
} from '$lib/actions/anchoredPosition';

function rectOf(anchor: HTMLElement, top: number, left: number, width: number, height: number) {
  anchor.getBoundingClientRect = () =>
    ({
      top,
      left,
      width,
      height,
      bottom: top + height,
      right: left + width,
      x: left,
      y: top,
      toJSON: () => ({})
    }) as DOMRect;
}

let node: HTMLElement;
let anchor: HTMLElement;

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<button id="anchor">Trigger</button><div id="surface"></div>';
  anchor = document.getElementById('anchor') as HTMLElement;
  node = document.getElementById('surface') as HTMLElement;
  rectOf(anchor, 100, 40, 160, 32);
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('anchoredPosition action', () => {
  it('pins the surface below its anchor as fixed-position coordinates', () => {
    const action = anchoredPosition(node, { anchor, gap: 6 });

    expect(node.style.position).toBe('fixed');
    expect(node.style.top).toBe('138px'); // 100 + 32 + 6
    expect(node.style.left).toBe('40px');
    expect(node.dataset.placement).toBe('bottom');

    action.destroy?.();
  });

  it('emits a min-width only when there is one to emit', () => {
    const withWidth = anchoredPosition(node, { anchor, matchAnchorWidth: true });
    expect(node.style.minWidth).toBe('160px');
    withWidth.destroy?.();

    node.style.minWidth = '';
    const without = anchoredPosition(node, { anchor });
    expect(node.style.minWidth).toBe('');
    without.destroy?.();
  });

  it('hands every computed position to onPosition', () => {
    const onPosition = vi.fn<(position: AnchoredPosition) => void>();
    const action = anchoredPosition(node, { anchor, onPosition, height: 200 });

    expect(onPosition).toHaveBeenCalledWith(
      expect.objectContaining({ top: 132, left: 40, placement: 'bottom' })
    );

    action.destroy?.();
  });

  it('accepts a getter for an anchor bound after the surface', () => {
    let late: HTMLElement | null = null;
    const action = anchoredPosition(node, { anchor: () => late });

    // Nothing to hang off yet: the surface is left exactly as it was.
    expect(node.style.position).toBe('');

    late = anchor;
    action.update?.({ anchor: () => late });
    expect(node.style.top).toBe('132px');

    action.destroy?.();
  });

  it('does nothing at all when the anchor never appears', () => {
    const action = anchoredPosition(node, { anchor: null });
    vi.advanceTimersByTime(50);

    expect(node.style.position).toBe('');
    expect(node.dataset.placement).toBeUndefined();

    action.destroy?.();
  });

  it('repositions on scroll and on resize, coalescing into one frame', () => {
    const onPosition = vi.fn();
    const action = anchoredPosition(node, { anchor, onPosition });
    onPosition.mockClear();

    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('resize'));
    // Three events, one scheduled frame.
    expect(onPosition).not.toHaveBeenCalled();

    rectOf(anchor, 300, 40, 160, 32);
    vi.advanceTimersByTime(20);

    expect(onPosition).toHaveBeenCalledTimes(1);
    expect(node.style.top).toBe('332px');

    action.destroy?.();
  });

  it('runs a second pass on the next frame, once the surface could have laid out', () => {
    const onPosition = vi.fn();
    const action = anchoredPosition(node, { anchor, onPosition });

    expect(onPosition).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(20);
    expect(onPosition).toHaveBeenCalledTimes(2);

    action.destroy?.();
  });

  it('removes both listeners and cancels the pending frame on destroy', () => {
    const removeListener = vi.spyOn(window, 'removeEventListener');
    const cancelFrame = vi.spyOn(globalThis, 'cancelAnimationFrame');
    const onPosition = vi.fn();

    const action = anchoredPosition(node, { anchor, onPosition });
    try {
      // Destroy while a frame from the initial second pass is still pending.
      action.destroy?.();

      expect(removeListener).toHaveBeenCalledWith('scroll', expect.any(Function), true);
      expect(removeListener).toHaveBeenCalledWith('resize', expect.any(Function));
      expect(cancelFrame).toHaveBeenCalledTimes(1);

      onPosition.mockClear();
      window.dispatchEvent(new Event('scroll'));
      window.dispatchEvent(new Event('resize'));
      vi.advanceTimersByTime(50);
      expect(onPosition).not.toHaveBeenCalled();
    } finally {
      removeListener.mockRestore();
      cancelFrame.mockRestore();
    }
  });

  it('leaves nothing scheduled once the frame has already run', () => {
    const cancelFrame = vi.spyOn(globalThis, 'cancelAnimationFrame');
    const action = anchoredPosition(node, { anchor });

    try {
      vi.advanceTimersByTime(20);
      action.destroy?.();
      expect(cancelFrame).not.toHaveBeenCalled();
    } finally {
      cancelFrame.mockRestore();
    }
  });
});

describe('computeAnchoredPosition with no viewport argument', () => {
  it('reads the real window instead of clamping against nothing', () => {
    // The node-environment suite covers the no-window fallback; this is the
    // other side of that branch, and jsdom is the only place it exists.
    const anchorRect = {
      top: 100,
      left: window.innerWidth - 60,
      width: 40,
      height: 32,
      bottom: 132,
      right: window.innerWidth - 20
    };
    const position = computeAnchoredPosition(anchorRect, { width: 400 });
    expect(position.left).toBe(window.innerWidth - 400 - 8);
  });
});
