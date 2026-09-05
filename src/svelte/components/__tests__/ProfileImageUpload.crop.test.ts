import { describe, expect, test } from '@jest/globals';
import {
  PRESETS,
  clampCrop,
  fitPreview,
  initialCrop,
  maxCropWidth,
  minCropWidth,
  sourceRect,
  widthForZoom,
  zoomPercent,
  type Crop,
  type Size
} from '../ProfileImageUpload.bloc.svelte';

/**
 * The crop maths, exercised without a DOM. These functions are exported from
 * the bloc precisely so this file can reach them: they are pure arithmetic
 * over sizes, and they are the part of the cropper that silently produces a
 * blurry or off-centre avatar when it is wrong.
 */

const AVATAR = PRESETS.avatar.aspect; // 1
const BANNER = PRESETS.banner.aspect; // 4

describe('fitPreview', () => {
  test('leaves a picture that already fits alone', () => {
    expect(fitPreview({ width: 400, height: 300 }, { width: 600, height: 400 })).toEqual({
      width: 400,
      height: 300
    });
  });

  test('scales down to the limiting axis, keeping the aspect', () => {
    const fitted = fitPreview({ width: 2000, height: 1000 }, { width: 600, height: 400 });
    expect(fitted).toEqual({ width: 600, height: 300 });
  });

  test('is limited by height when that is the tighter axis', () => {
    const fitted = fitPreview({ width: 1000, height: 2000 }, { width: 600, height: 400 });
    expect(fitted).toEqual({ width: 200, height: 400 });
  });
});

describe('initialCrop', () => {
  test('a square crop on a tall picture is the full width, vertically centred', () => {
    const display: Size = { width: 300, height: 500 };
    expect(initialCrop(display, AVATAR)).toEqual({ width: 300, x: 0, y: 100 });
  });

  test('a square crop on a wide picture is the full height, horizontally centred', () => {
    const display: Size = { width: 500, height: 300 };
    expect(initialCrop(display, AVATAR)).toEqual({ width: 300, x: 100, y: 0 });
  });

  test('a 4:1 strip on a 2:1 picture takes the full width and centres vertically', () => {
    const display: Size = { width: 800, height: 400 };
    // 800 wide is 200 tall at 4:1, so 100px of slack above and below.
    expect(initialCrop(display, BANNER)).toEqual({ width: 800, x: 0, y: 100 });
  });
});

describe('maxCropWidth / minCropWidth', () => {
  test('the widest box of the aspect that still fits', () => {
    expect(maxCropWidth({ width: 300, height: 500 }, AVATAR)).toBe(300);
    expect(maxCropWidth({ width: 500, height: 300 }, AVATAR)).toBe(300);
    expect(maxCropWidth({ width: 800, height: 400 }, BANNER)).toBe(800);
  });

  test('the tightest allowed frame is half the widest', () => {
    expect(minCropWidth({ width: 300, height: 500 }, AVATAR)).toBe(150);
  });
});

describe('clampCrop', () => {
  const display: Size = { width: 400, height: 300 };
  const crop: Crop = { x: 0, y: 0, width: 200 };

  test('keeps the box inside the right and bottom edges', () => {
    expect(clampCrop({ ...crop, x: 999, y: 999 }, display, AVATAR)).toEqual({
      width: 200,
      x: 200,
      y: 100
    });
  });

  test('keeps the box inside the top and left edges', () => {
    expect(clampCrop({ ...crop, x: -50, y: -50 }, display, AVATAR)).toEqual({
      width: 200,
      x: 0,
      y: 0
    });
  });

  test('a box wider than the picture is pinned at the origin, not pushed negative', () => {
    expect(clampCrop({ x: 10, y: 10, width: 900 }, display, AVATAR)).toEqual({
      width: 900,
      x: 0,
      y: 0
    });
  });
});

describe('zoom', () => {
  const display: Size = { width: 400, height: 400 };

  test('the widest box is zero zoom and the tightest is full zoom', () => {
    expect(zoomPercent(400, display, AVATAR)).toBe(0);
    expect(zoomPercent(200, display, AVATAR)).toBe(100);
  });

  test('round-trips through widthForZoom', () => {
    for (const percent of [0, 25, 50, 75, 100]) {
      const width = widthForZoom(percent, display, AVATAR);
      expect(zoomPercent(width, display, AVATAR)).toBeCloseTo(percent);
    }
  });

  test('a slider value outside the rail is clamped rather than exceeding the bounds', () => {
    expect(widthForZoom(-40, display, AVATAR)).toBe(400);
    expect(widthForZoom(140, display, AVATAR)).toBe(200);
  });

  test('a picture with no room to zoom reports zero rather than dividing by zero', () => {
    expect(zoomPercent(0, { width: 0, height: 0 }, AVATAR)).toBe(0);
  });
});

describe('sourceRect', () => {
  test('scales the on-screen crop back up to source pixels', () => {
    // A 2000x2000 source shown at 500x500: everything is 4x.
    const rect = sourceRect(
      { x: 25, y: 50, width: 200 },
      { width: 2000, height: 2000 },
      { width: 500, height: 500 },
      AVATAR
    );
    expect(rect).toEqual({ sx: 100, sy: 200, sw: 800, sh: 800 });
  });

  test('a 4:1 crop keeps its aspect in source pixels', () => {
    const rect = sourceRect(
      { x: 0, y: 10, width: 400 },
      { width: 1600, height: 800 },
      { width: 800, height: 400 },
      BANNER
    );
    expect(rect.sw / rect.sh).toBe(4);
  });

  test('an unmeasured preview yields an empty rectangle instead of NaN', () => {
    const rect = sourceRect(
      { x: 0, y: 0, width: 0 },
      { width: 1000, height: 1000 },
      { width: 0, height: 0 },
      AVATAR
    );
    expect(rect).toEqual({ sx: 0, sy: 0, sw: 0, sh: 0 });
  });
});
