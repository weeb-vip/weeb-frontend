import { describe, it, expect } from 'vitest';
import { chipClass, chipColor, chipStyle, isColored, type ChipTone } from './Chip.logic';

const TONES: ChipTone[] = ['neutral', 'accent', 'green', 'amber', 'red'];

const base = {
  tone: 'neutral' as ChipTone,
  size: 'md' as const,
  color: undefined as string | undefined,
  tintAtRest: false,
  ghost: false,
  touch: false,
  mono: false,
  selected: false,
  disabled: false,
  className: ''
};

describe('chipColor', () => {
  it('gives each tone its own token', () => {
    expect(chipColor('green', undefined)).toBe('var(--weeb-green)');
    expect(chipColor('amber', undefined)).toBe('var(--weeb-amber)');
    expect(chipColor('red', undefined)).toBe('var(--weeb-red)');
    expect(chipColor('accent', undefined)).toBe('var(--weeb-accent)');
  });

  it('lets an explicit colour win over the tone', () => {
    expect(chipColor('green', 'var(--cat-release)')).toBe('var(--cat-release)');
  });

  it('gives even the neutral chip a colour to tint from when selected', () => {
    expect(chipColor('neutral', undefined)).toBe('var(--weeb-accent)');
  });
});

describe('chipStyle', () => {
  it('writes the one custom property every chip rule reads', () => {
    expect(chipStyle('green', undefined)).toBe('--chip-color: var(--weeb-green);');
    expect(chipStyle('neutral', '#f00')).toBe('--chip-color: #f00;');
  });
});

describe('isColored', () => {
  it('is false only for a neutral chip with no colour of its own', () => {
    expect(isColored('neutral', undefined)).toBe(false);
  });

  it('is true for every other tone', () => {
    for (const tone of TONES.filter((t) => t !== 'neutral')) {
      expect(isColored(tone, undefined)).toBe(true);
    }
  });

  it('is true for a neutral chip given an explicit colour', () => {
    // Which is how the news category chips tell four categories apart.
    expect(isColored('neutral', 'var(--cat-release)')).toBe(true);
  });
});

describe('chipClass', () => {
  it('always names the pill and its size', () => {
    expect(chipClass(base)).toBe('chip chip--md');
    expect(chipClass({ ...base, size: 'sm' })).toBe('chip chip--sm');
  });

  it('marks a chip that has a colour of its own', () => {
    expect(chipClass({ ...base, tone: 'green' })).toContain('chip--colored');
    expect(chipClass(base)).not.toContain('chip--colored');
  });

  it('tints at rest only when both coloured and asked to', () => {
    expect(chipClass({ ...base, tone: 'green', tintAtRest: true })).toContain('chip--toned');
    expect(chipClass({ ...base, tone: 'green', tintAtRest: false })).not.toContain('chip--toned');
    // A neutral chip has nothing to tint with.
    expect(chipClass({ ...base, tintAtRest: true })).not.toContain('chip--toned');
  });

  it('adds each modifier only when it is on', () => {
    expect(chipClass({ ...base, ghost: true })).toContain('chip--ghost');
    expect(chipClass({ ...base, touch: true })).toContain('chip--touch');
    expect(chipClass({ ...base, mono: true })).toContain('chip--mono');
    expect(chipClass({ ...base, selected: true })).toContain('selected');
    expect(chipClass({ ...base, disabled: true })).toContain('is-disabled');
  });

  it('keeps the caller’s class', () => {
    expect(chipClass({ ...base, className: 'facet' })).toContain('facet');
  });

  it('emits no empty class fragments', () => {
    expect(chipClass(base)).not.toMatch(/\s{2}|\s$/);
  });
});
