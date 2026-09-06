import { describe, it, expect } from 'vitest';
import { hasNext, hasPrev, parsePerPage, showsPerPage } from './Pagination.logic';

/** `page` is zero-based at every call site; `page + 1` is only the label. */

describe('hasPrev', () => {
  it('is false on the first page', () => {
    expect(hasPrev(0)).toBe(false);
  });

  it('is true from the second page on', () => {
    expect(hasPrev(1)).toBe(true);
    expect(hasPrev(9)).toBe(true);
  });
});

describe('hasNext', () => {
  it('is true while there is a page after this one', () => {
    expect(hasNext(0, 3)).toBe(true);
    expect(hasNext(1, 3)).toBe(true);
  });

  it('is false on the last page', () => {
    expect(hasNext(2, 3)).toBe(false);
  });

  it('is false when there is nothing to page through', () => {
    expect(hasNext(0, 0)).toBe(false);
    expect(hasNext(0, 1)).toBe(false);
  });
});

describe('showsPerPage', () => {
  it('draws the select only when there is a choice to make', () => {
    expect(showsPerPage(24, [24, 48])).toBe(true);
  });

  it('draws nothing when the caller offers no sizes', () => {
    expect(showsPerPage(24, [])).toBe(false);
  });

  it('draws nothing when the caller does not control the size at all', () => {
    expect(showsPerPage(undefined, [24, 48])).toBe(false);
  });
});

describe('parsePerPage', () => {
  it('takes a number, or a numeric string from the select', () => {
    expect(parsePerPage(48)).toBe(48);
    expect(parsePerPage('48')).toBe(48);
  });

  it('refuses a value that is not a number', () => {
    expect(parsePerPage('all')).toBeNull();
  });

  it('reads an empty selection as zero, which the caller then rejects', () => {
    // `Number('')` is 0, not NaN; the bloc's own guard is what stops it.
    expect(parsePerPage('')).toBe(0);
  });
});
