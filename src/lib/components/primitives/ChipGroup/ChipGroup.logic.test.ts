import { describe, it, expect } from 'vitest';
import {
  affordanceClass,
  chipSizeFor,
  containerRole,
  currentFor,
  isTablist,
  isTouch,
  keyOf,
  keyTarget,
  nextEnabled,
  pressedFor,
  selectedIndexOf,
  selectedOf,
  showMore,
  tabIndexFor,
  type ChipGroupItem
} from './ChipGroup.logic';

const items = (...labels: string[]): ChipGroupItem[] => labels.map((label) => ({ label }));

describe('keyOf', () => {
  it('prefers the explicit value and falls back to the label', () => {
    expect(keyOf({ value: 'tv', label: 'TV' })).toBe('tv');
    expect(keyOf({ label: 'TV' })).toBe('TV');
  });

  it('keeps an empty-string value rather than treating it as missing', () => {
    // '' is the "Not tracking" / "All" key on several rows.
    expect(keyOf({ value: '', label: 'All' })).toBe('');
  });
});

describe('the ARIA shape of the row', () => {
  it('is a tablist only when one chip at a time reveals a panel', () => {
    expect(isTablist('single', 'tabs')).toBe(true);
    expect(isTablist('single', 'toggle')).toBe(false);
    expect(isTablist('multi', 'tabs')).toBe(false);
    expect(isTablist('none', 'tabs')).toBe(false);
  });

  it('gives a tablist role="tablist"', () => {
    expect(containerRole('single', 'tabs', undefined)).toBe('tablist');
    expect(containerRole('single', 'tabs', 'Status')).toBe('tablist');
  });

  it('gives every other selecting row role="group"', () => {
    expect(containerRole('single', 'toggle', undefined)).toBe('group');
    expect(containerRole('multi', 'tabs', undefined)).toBe('group');
    expect(containerRole('multi', 'toggle', 'Genres')).toBe('group');
  });

  it('is not a landmark at all when it selects nothing and names nothing', () => {
    expect(containerRole('none', 'tabs', undefined)).toBeUndefined();
    expect(containerRole('none', 'toggle', undefined)).toBeUndefined();
  });

  it('is a group once a nothing-selecting row has a name worth announcing', () => {
    expect(containerRole('none', 'toggle', 'Browse genres')).toBe('group');
  });
});

describe('the size', () => {
  it('passes sm through and treats everything else as the default chip size', () => {
    expect(chipSizeFor('sm')).toBe('sm');
    expect(chipSizeFor('md')).toBe('md');
    // `touch` is a height, not a type scale.
    expect(chipSizeFor('touch')).toBe('md');
  });

  it('only touch raises the row to the 44px target', () => {
    expect(isTouch('touch')).toBe(true);
    expect(isTouch('sm')).toBe(false);
    expect(isTouch('md')).toBe(false);
  });
});

describe('which chip counts as selected', () => {
  it('matches the single-select value by key', () => {
    expect(selectedOf('tv', 'single', 'tv', undefined)).toBe(true);
    expect(selectedOf('ova', 'single', 'tv', undefined)).toBe(false);
  });

  it('never selects by value in a multi or none row -- they own their own answer', () => {
    expect(selectedOf('tv', 'multi', 'tv', undefined)).toBe(false);
    expect(selectedOf('tv', 'none', 'tv', undefined)).toBe(false);
  });

  it('defers entirely to the caller’s predicate when there is one', () => {
    const isSelected = (value: string) => value === 'ova';

    expect(selectedOf('ova', 'multi', undefined, isSelected)).toBe(true);
    // The predicate wins even where `value` says otherwise.
    expect(selectedOf('tv', 'single', 'tv', isSelected)).toBe(false);
  });
});

describe('how the selected chip is marked', () => {
  it('marks every multi-select chip with aria-pressed, on or off', () => {
    expect(pressedFor(true, 'multi', 'toggle', 'pressed')).toBe(true);
    expect(pressedFor(false, 'multi', 'toggle', 'pressed')).toBe(false);
    expect(pressedFor(false, 'multi', 'tabs', 'current')).toBe(false);
  });

  it('marks a single-select mode switch with aria-pressed', () => {
    expect(pressedFor(true, 'single', 'toggle', 'pressed')).toBe(true);
    expect(pressedFor(false, 'single', 'toggle', 'pressed')).toBe(false);
  });

  it('leaves a tab unpressed -- role=tab carries aria-selected instead', () => {
    expect(pressedFor(true, 'single', 'tabs', 'pressed')).toBeUndefined();
  });

  it('leaves a navigating strip unpressed -- nothing gets pressed', () => {
    expect(pressedFor(true, 'single', 'toggle', 'current')).toBeUndefined();
  });

  it('marks a navigating strip’s active chip aria-current="page"', () => {
    expect(currentFor(true, 'single', 'toggle', 'current')).toBe('page');
  });

  it('marks nothing current when the chip is off, or in any other shape', () => {
    expect(currentFor(false, 'single', 'toggle', 'current')).toBeUndefined();
    expect(currentFor(true, 'single', 'toggle', 'pressed')).toBeUndefined();
    expect(currentFor(true, 'single', 'tabs', 'current')).toBeUndefined();
    expect(currentFor(true, 'multi', 'toggle', 'current')).toBeUndefined();
  });

  it('never marks a chip both pressed and current', () => {
    for (const marker of ['pressed', 'current'] as const) {
      const pressed = pressedFor(true, 'single', 'toggle', marker);
      const current = currentFor(true, 'single', 'toggle', marker);

      expect(pressed !== undefined && current !== undefined).toBe(false);
    }
  });
});

describe('the "+N more" affordance', () => {
  it('is absent when there is no `more` at all', () => {
    expect(showMore(undefined)).toBe(false);
  });

  it('is drawn while chips are still hidden', () => {
    expect(showMore({ hiddenCount: 3, expanded: false, onToggle: () => {} })).toBe(true);
  });

  it('is not drawn when nothing is hidden', () => {
    expect(showMore({ hiddenCount: 0, expanded: false, onToggle: () => {} })).toBe(false);
  });

  it('goes away after a one-way reveal', () => {
    expect(showMore({ hiddenCount: 3, expanded: true, onToggle: () => {} })).toBe(false);
  });

  it('stays as "Show less" when the reveal is reversible', () => {
    expect(
      showMore({ hiddenCount: 3, expanded: true, onToggle: () => {}, collapseLabel: 'Show less' })
    ).toBe(true);
  });
});

describe('roving arrow keys', () => {
  it('finds the selected item by key', () => {
    expect(selectedIndexOf(items('A', 'B', 'C'), 'B')).toBe(1);
    expect(selectedIndexOf(items('A', 'B'), 'Z')).toBe(-1);
    expect(selectedIndexOf(items('A', 'B'), undefined)).toBe(-1);
  });

  it('moves one step and wraps at both ends', () => {
    const row = items('A', 'B', 'C');

    expect(nextEnabled(row, 0, 1)).toBe(1);
    expect(nextEnabled(row, 2, 1)).toBe(0);
    expect(nextEnabled(row, 0, -1)).toBe(2);
  });

  it('skips disabled chips', () => {
    const row: ChipGroupItem[] = [
      { label: 'A' },
      { label: 'B', disabled: true },
      { label: 'C' }
    ];

    expect(nextEnabled(row, 0, 1)).toBe(2);
    expect(nextEnabled(row, 2, -1)).toBe(0);
  });

  it('stays put when every other chip is disabled', () => {
    const row: ChipGroupItem[] = [
      { label: 'A' },
      { label: 'B', disabled: true },
      { label: 'C', disabled: true }
    ];

    expect(nextEnabled(row, 0, 1)).toBe(0);
  });

  it('has nowhere to go in an empty row', () => {
    expect(nextEnabled([], 0, 1)).toBe(-1);
    expect(keyTarget('ArrowRight', [], -1)).toBe(-1);
  });

  it('treats Down like Right and Up like Left', () => {
    const row = items('A', 'B', 'C');

    expect(keyTarget('ArrowDown', row, 0)).toBe(keyTarget('ArrowRight', row, 0));
    expect(keyTarget('ArrowUp', row, 1)).toBe(keyTarget('ArrowLeft', row, 1));
  });

  it('sends Home to the first enabled chip and End to the last', () => {
    const row: ChipGroupItem[] = [
      { label: 'A', disabled: true },
      { label: 'B' },
      { label: 'C' },
      { label: 'D', disabled: true }
    ];

    expect(keyTarget('Home', row, 2)).toBe(1);
    expect(keyTarget('End', row, 0)).toBe(2);
  });

  it('starts from the first chip when nothing is selected yet', () => {
    const row = items('A', 'B', 'C');

    expect(keyTarget('ArrowRight', row, -1)).toBe(1);
    expect(keyTarget('ArrowLeft', row, -1)).toBe(2);
  });

  it('answers to nothing else', () => {
    const row = items('A', 'B');

    for (const key of ['Enter', ' ', 'Tab', 'Escape', 'a', 'PageDown']) {
      expect(keyTarget(key, row, 0)).toBeNull();
    }
  });

  it('is offered only to a single-select row', () => {
    // The view delegates keydown only where the container is a tablist, so the
    // two answers have to agree: a multi row is a set of independent toggles
    // and each is its own tab stop.
    expect(isTablist('multi', 'tabs')).toBe(false);
    expect(tabIndexFor(1, isTablist('multi', 'tabs'), 0)).toBeUndefined();
    expect(tabIndexFor(1, isTablist('none', 'tabs'), 0)).toBeUndefined();
  });
});

describe('the roving tab stop', () => {
  it('gives a tablist exactly one tab stop, on the selected chip', () => {
    expect(tabIndexFor(0, true, 1)).toBe(-1);
    expect(tabIndexFor(1, true, 1)).toBe(0);
    expect(tabIndexFor(2, true, 1)).toBe(-1);
  });

  it('puts the tab stop on the first chip when nothing is selected', () => {
    expect(tabIndexFor(0, true, -1)).toBe(0);
    expect(tabIndexFor(1, true, -1)).toBe(-1);
  });

  it('leaves every chip individually reachable outside a tablist', () => {
    expect(tabIndexFor(0, false, 1)).toBeUndefined();
    expect(tabIndexFor(3, false, -1)).toBeUndefined();
  });
});

describe('affordanceClass', () => {
  it('names the kind and keeps the caller’s class', () => {
    expect(affordanceClass('clear', 'facet')).toBe('cg-affordance cg-clear facet facet--clear');
    expect(affordanceClass('more', 'facet')).toBe('cg-affordance cg-more facet facet--more');
  });

  it('emits no empty class fragments when the caller passed none', () => {
    expect(affordanceClass('more', '')).toBe('cg-affordance cg-more');
  });
});
