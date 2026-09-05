import { describe, expect, test } from '@jest/globals';
import {
  computeAnchoredPosition,
  anchoredPositionStyle,
  type AnchorRect,
  type Viewport
} from '../anchoredPosition';

const viewport: Viewport = { width: 1000, height: 800 };

/** Build a rect the way `getBoundingClientRect()` would report one. */
function rect(top: number, left: number, width: number, height: number): AnchorRect {
  return { top, left, width, height, bottom: top + height, right: left + width };
}

describe('computeAnchoredPosition — vertical placement', () => {
  test('sits directly below the anchor, offset by the gap', () => {
    const pos = computeAnchoredPosition(rect(100, 100, 120, 32), { gap: 6 }, viewport);
    expect(pos.top).toBe(138);
    expect(pos.placement).toBe('bottom');
  });

  test('stays below when it fits, even with a known height', () => {
    const pos = computeAnchoredPosition(rect(100, 100, 120, 32), { height: 280 }, viewport);
    expect(pos.top).toBe(132);
    expect(pos.placement).toBe('bottom');
  });

  test('flips above when below does not fit and above has more room', () => {
    // Anchor near the bottom: 132px below, 700px above.
    const pos = computeAnchoredPosition(rect(700, 100, 120, 32), { height: 280 }, viewport);
    expect(pos.placement).toBe('top');
    expect(pos.top).toBe(420); // 700 - 280
  });

  test('flipping respects the gap on the way up', () => {
    const pos = computeAnchoredPosition(rect(700, 100, 120, 32), { height: 280, gap: 6 }, viewport);
    expect(pos.top).toBe(414); // 700 - 280 - 6
  });

  test('does not flip when above is just as cramped as below', () => {
    // 400px tall surface, anchor mid-screen: neither side fits, below wins.
    const pos = computeAnchoredPosition(rect(360, 100, 120, 32), { height: 400 }, viewport);
    expect(pos.placement).toBe('bottom');
    // Clamped so the bottom edge stays inside the viewport margin.
    expect(pos.top).toBe(392); // 800 - 400 - 8
  });

  test('flip: false keeps it below and merely clamps', () => {
    const pos = computeAnchoredPosition(
      rect(700, 100, 120, 32),
      { height: 280, flip: false },
      viewport
    );
    expect(pos.placement).toBe('bottom');
    expect(pos.top).toBe(512); // 800 - 280 - 8
  });

  test('a surface taller than the viewport pins to the top margin, not a negative top', () => {
    // The clamp order that the hand-rolled copies got wrong: clamping the top
    // edge first and the bottom edge second leaves top at 800 - 1200 - 8.
    const pos = computeAnchoredPosition(rect(400, 100, 120, 32), { height: 1200 }, viewport);
    expect(pos.top).toBe(8);
  });

  test('an unknown height is never clamped or flipped', () => {
    const pos = computeAnchoredPosition(rect(780, 100, 120, 32), {}, viewport);
    expect(pos.top).toBe(812);
    expect(pos.placement).toBe('bottom');
  });

  test('honours a custom viewport margin', () => {
    const pos = computeAnchoredPosition(
      rect(700, 100, 120, 32),
      { height: 280, flip: false, margin: 16 },
      viewport
    );
    expect(pos.top).toBe(504); // 800 - 280 - 16
  });
});

describe('computeAnchoredPosition — horizontal alignment', () => {
  test('left alignment matches the anchor left edge', () => {
    const pos = computeAnchoredPosition(rect(100, 240, 120, 32), { width: 180 }, viewport);
    expect(pos.left).toBe(240);
  });

  test('right alignment matches the anchor right edge', () => {
    const pos = computeAnchoredPosition(
      rect(100, 240, 120, 32),
      { align: 'right', width: 180 },
      viewport
    );
    expect(pos.left).toBe(180); // 360 - 180
  });

  test('center alignment centres the surface on the anchor', () => {
    const pos = computeAnchoredPosition(
      rect(100, 240, 120, 32),
      { align: 'center', width: 350 },
      viewport
    );
    expect(pos.left).toBe(125); // 300 - 175
  });

  test('pulls back from the right viewport edge', () => {
    const pos = computeAnchoredPosition(rect(100, 900, 80, 32), { width: 200 }, viewport);
    expect(pos.left).toBe(792); // 1000 - 200 - 8
  });

  test('pulls back from the left viewport edge', () => {
    const pos = computeAnchoredPosition(
      rect(100, 10, 40, 32),
      { align: 'right', width: 200 },
      viewport
    );
    expect(pos.left).toBe(8);
  });

  test('a surface wider than the viewport overflows right, not left', () => {
    const pos = computeAnchoredPosition(rect(100, 400, 40, 32), { width: 1400 }, viewport);
    expect(pos.left).toBe(8);
  });

  test('centering on a narrow mobile viewport still clears both margins', () => {
    const mobile: Viewport = { width: 375, height: 700 };
    const pos = computeAnchoredPosition(
      rect(100, 330, 40, 32),
      { align: 'center', width: 343, margin: 16 },
      mobile
    );
    expect(pos.left).toBe(16);
    expect(pos.left + pos.width).toBeLessThanOrEqual(mobile.width - 16);
  });
});

describe('computeAnchoredPosition — width', () => {
  test('matchAnchorWidth floors the surface at the anchor width', () => {
    const pos = computeAnchoredPosition(
      rect(100, 100, 220, 32),
      { matchAnchorWidth: true },
      viewport
    );
    expect(pos.minWidth).toBe(220);
    expect(pos.width).toBe(220);
  });

  test('minWidth wins when the anchor is narrower', () => {
    const pos = computeAnchoredPosition(
      rect(100, 100, 90, 32),
      { matchAnchorWidth: true, minWidth: 180 },
      viewport
    );
    expect(pos.minWidth).toBe(180);
    expect(pos.width).toBe(180);
  });

  test('a measured width beats the minimum for edge clamping but not for min-width', () => {
    const pos = computeAnchoredPosition(
      rect(100, 900, 90, 32),
      { minWidth: 180, width: 260 },
      viewport
    );
    expect(pos.width).toBe(260);
    expect(pos.minWidth).toBe(180);
    expect(pos.left).toBe(732); // 1000 - 260 - 8
  });

  test('without matchAnchorWidth the anchor width does not become a floor', () => {
    const pos = computeAnchoredPosition(rect(100, 100, 400, 32), {}, viewport);
    expect(pos.minWidth).toBe(0);
    expect(pos.width).toBe(0);
  });
});

describe('computeAnchoredPosition — no window', () => {
  test('falls back to an unconstrained placement below the anchor', () => {
    // No viewport argument and no `window` in the jest node environment.
    const pos = computeAnchoredPosition(rect(600, 900, 120, 32), { height: 400, gap: 8 });
    expect(pos.top).toBe(640);
    expect(pos.left).toBe(900);
    expect(pos.placement).toBe('bottom');
  });
});

describe('anchoredPositionStyle', () => {
  test('emits the fixed-position style the portalled surfaces need', () => {
    const pos = computeAnchoredPosition(
      rect(100, 100, 120, 32),
      { matchAnchorWidth: true, gap: 6 },
      viewport
    );
    expect(anchoredPositionStyle(pos)).toBe(
      'position: fixed; top: 138px; left: 100px; min-width: 120px;'
    );
  });
});
