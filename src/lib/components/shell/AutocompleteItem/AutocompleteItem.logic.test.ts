import { describe, it, expect } from 'vitest';
import { autocompleteItemView, isWorkHit } from './AutocompleteItem.logic';

/**
 * Anime and works come from two indexes with two shapes; every difference is
 * decided here so the row's markup is one shape.
 */

describe('isWorkHit', () => {
  it('reads the tag the index put there, rather than sniffing fields', () => {
    expect(isWorkHit({ __kind: 'work' })).toBe(true);
    expect(isWorkHit({ __kind: 'anime' })).toBe(false);
    expect(isWorkHit({ id: 'a1', title: 'Frieren' })).toBe(false);
  });

  it('is false for nothing at all', () => {
    expect(isWorkHit(null)).toBe(false);
    expect(isWorkHit(undefined)).toBe(false);
  });
});

describe('autocompleteItemView', () => {
  describe('an anime hit', () => {
    it('hands SafeImage the record id and no folder', () => {
      const view = autocompleteItemView({ id: 'a1', start_date: '2023-09-29T00:00:00Z' });

      // A finished URL would get encoded into another one.
      expect(view.imageSrc).toBe('a1');
      expect(view.imagePath).toBe('');
    });

    it('has a placeholder for a record with no id', () => {
      expect(autocompleteItemView({ start_date: null }).imageSrc).toBe('not found.png');
    });

    it('shows the year alone under the title', () => {
      expect(autocompleteItemView({ id: 'a1', start_date: '2023-09-29T00:00:00Z' }).subtitle).toBe(
        '2023'
      );
    });

    it('says TBA rather than a broken year', () => {
      expect(autocompleteItemView({ id: 'a1', start_date: null }).subtitle).toBe('TBA');
      expect(autocompleteItemView({ id: 'a1', start_date: 'soon' }).subtitle).toBe('TBA');
    });

    it('falls back to the local placeholder image', () => {
      expect(autocompleteItemView({ id: 'a1' }).imageFallback).toBe('/assets/not found.jpg');
    });
  });

  describe('a work hit', () => {
    const work = (extra: Record<string, unknown> = {}) => ({
      __kind: 'work',
      id: 'w1',
      type: 'LIGHT_NOVEL',
      published_from: '2012-04-01T00:00:00Z',
      ...extra
    });

    it('looks the cover up under the works folder', () => {
      const view = autocompleteItemView(work());

      expect(view.imageSrc).toBe('w1');
      expect(view.imagePath).toBe('works');
    });

    it('names what kind of thing it is before the year', () => {
      // "Light novel" is what distinguishes it from the anime a few rows above
      // it under the same name.
      expect(autocompleteItemView(work()).subtitle).toBe('Light novel · 2012');
    });

    it('drops the year rather than printing a dangling separator', () => {
      expect(autocompleteItemView(work({ published_from: null })).subtitle).toBe(
        'Light novel · TBA'
      );
    });

    it('has a word for a work whose type the index did not set', () => {
      expect(autocompleteItemView(work({ type: null })).subtitle).toBe('Work · 2012');
    });

    it('uses MyAnimeList’s own host only if the cover has not reached the CDN', () => {
      expect(autocompleteItemView(work({ image_url: 'https://cdn.mal/x.jpg' })).imageFallback).toBe(
        'https://cdn.mal/x.jpg'
      );
      expect(autocompleteItemView(work()).imageFallback).toBe('/assets/not found.jpg');
    });

    it('has an id to draw with even for an untagged row', () => {
      expect(autocompleteItemView({ __kind: 'work' }).imageSrc).toBe('');
    });
  });
});
