import { describe, it, expect } from 'vitest';
import {
  MENU_MIN_WIDTH,
  isSelectedOption,
  menuPlacement,
  movedIndex,
  opensMenu,
  optionIndexOf,
  selectedOption,
  triggerLabel,
  type SelectOption
} from './Select.logic';

const OPTIONS: SelectOption[] = [
  { value: '', label: 'Any' },
  { value: 24, label: '24' },
  { value: 'tv', label: 'TV' }
];

describe('finding the option a value names', () => {
  it('compares as text, because the same call sites send both', () => {
    expect(optionIndexOf(OPTIONS, 24)).toBe(1);
    expect(optionIndexOf(OPTIONS, '24')).toBe(1);
    expect(selectedOption(OPTIONS, '24')?.label).toBe('24');
    expect(isSelectedOption(OPTIONS[1], 24)).toBe(true);
  });

  it('finds the empty option rather than treating it as nothing', () => {
    expect(optionIndexOf(OPTIONS, '')).toBe(0);
    expect(selectedOption(OPTIONS, '')?.label).toBe('Any');
  });

  it('reports no match for a value that is not in the list', () => {
    expect(optionIndexOf(OPTIONS, 'ova')).toBe(-1);
    expect(selectedOption(OPTIONS, 'ova')).toBeUndefined();
    expect(isSelectedOption(OPTIONS[1], 'ova')).toBe(false);
  });
});

describe('triggerLabel', () => {
  it('names the selected option', () => {
    expect(triggerLabel(OPTIONS, 'tv', 'Type')).toBe('TV');
  });

  it('falls back to the placeholder when nothing matches', () => {
    expect(triggerLabel(OPTIONS, 'ova', 'Type')).toBe('Type');
    expect(triggerLabel([], 'tv', 'Type')).toBe('Type');
  });
});

describe('menuPlacement', () => {
  const rect = (over: Partial<DOMRect> = {}) =>
    ({ top: 100, bottom: 132, left: 40, right: 240, width: 200, ...over }) as DOMRect;

  it('sits below the trigger', () => {
    expect(menuPlacement(rect(), 'left', 1280).top).toBe(138);
  });

  it('hangs off the trigger’s left edge by default', () => {
    expect(menuPlacement(rect(), 'left', 1280).left).toBe(40);
  });

  it('right-aligns to the trigger’s right edge', () => {
    expect(menuPlacement(rect(), 'right', 1280).left).toBe(40);
  });

  it('is never narrower than the minimum, however small the trigger', () => {
    const placement = menuPlacement(rect({ left: 320, right: 400, width: 80 }), 'right', 1280);

    // Right-aligned to the trigger's right edge at the MENU_MIN_WIDTH width.
    expect(placement.left).toBe(400 - MENU_MIN_WIDTH);
    // The trigger's own width is reported separately as `minWidth`.
    expect(placement.minWidth).toBe(80);
  });

  it('pulls a menu back on screen at the right-hand edge', () => {
    const placement = menuPlacement(rect({ left: 1150, right: 1270, width: 120 }), 'left', 1280);

    // A filter at the edge would otherwise open a menu running off the page.
    expect(placement.left).toBe(1280 - MENU_MIN_WIDTH - 8);
  });

  it('never pushes it off the left edge either', () => {
    const placement = menuPlacement(rect({ left: 0, right: 40, width: 40 }), 'right', 320);

    expect(placement.left).toBe(8);
  });
});

describe('movedIndex', () => {
  it('starts at the top on a first arrow from nowhere', () => {
    expect(movedIndex(-1, 1, 3)).toBe(0);
    expect(movedIndex(-1, -1, 3)).toBe(0);
  });

  it('moves one row at a time', () => {
    expect(movedIndex(0, 1, 3)).toBe(1);
    expect(movedIndex(2, -1, 3)).toBe(1);
  });

  it('clamps rather than wrapping, which is what a native select does', () => {
    expect(movedIndex(2, 1, 3)).toBe(2);
    expect(movedIndex(0, -1, 3)).toBe(0);
  });

  it('stays put in an empty list', () => {
    expect(movedIndex(-1, 1, 0)).toBe(-1);
  });
});

describe('opensMenu', () => {
  it('answers to the keys a native select answers to', () => {
    for (const key of ['ArrowDown', 'ArrowUp', 'Enter', ' ']) {
      expect(opensMenu(key)).toBe(true);
    }
  });

  it('answers to nothing else', () => {
    for (const key of ['Escape', 'Tab', 'a', 'Home', 'ArrowLeft']) {
      expect(opensMenu(key)).toBe(false);
    }
  });
});
