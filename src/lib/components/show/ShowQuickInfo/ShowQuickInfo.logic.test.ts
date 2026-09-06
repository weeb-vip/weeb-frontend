import { describe, it, expect } from 'vitest';
import { SCORE_OPTIONS } from './ShowQuickInfo.logic';

describe('SCORE_OPTIONS', () => {
  it('opens with "no score yet", which is what the empty <option> was', () => {
    expect(SCORE_OPTIONS[0]).toEqual({ value: '', label: 'Score' });
  });

  it('offers ten down to one, highest first', () => {
    expect(SCORE_OPTIONS.slice(1).map((o) => o.value)).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  });

  it('labels each score as its own number', () => {
    for (const option of SCORE_OPTIONS.slice(1)) {
      expect(option.label).toBe(String(option.value));
    }
  });

  it('has one row per score plus the blank', () => {
    expect(SCORE_OPTIONS).toHaveLength(11);
  });
});
