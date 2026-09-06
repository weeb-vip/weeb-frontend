import { describe, it, expect, vi } from 'vitest';
import { englishTitles, noCardTracking, titleFor } from './Card.bloc.svelte';

/**
 * The shared card rule: whoever owns the preference resolves the title, and a
 * card is handed the string it should draw. One answer, not four.
 */

const ANIME = { titleEn: 'Frieren', titleJp: '葬送のフリーレン' };

describe('titleFor', () => {
  it('gives the English title to an English reader', () => {
    expect(titleFor(ANIME, 'english')).toBe('Frieren');
  });

  it('gives the Japanese title to a Japanese reader', () => {
    expect(titleFor(ANIME, 'japanese')).toBe('葬送のフリーレン');
  });

  it('falls back to whichever title exists rather than showing nothing', () => {
    expect(titleFor({ titleJp: 'JP' }, 'english')).toBe('JP');
    expect(titleFor({ titleEn: 'EN' }, 'japanese')).toBe('EN');
  });

  it('has something to draw for a record with no title, or no record', () => {
    expect(titleFor({}, 'english')).toBe('Unknown');
    expect(titleFor(null, 'english')).toBe('Unknown');
    expect(titleFor(undefined, 'japanese')).toBe('Unknown');
  });
});

describe('the story/test ports', () => {
  it('englishTitles answers without a store behind it', () => {
    expect(englishTitles()).toBe('english');
  });

  it('noCardTracking reports nothing, so opening a card is inert', () => {
    expect(noCardTracking('a1', 'Frieren')).toBeUndefined();
  });

  it('a card resolves its title through the injected port', () => {
    // This is the whole seam: the rail is given records, not titles.
    const language = vi.fn(englishTitles);

    expect(titleFor(ANIME, language())).toBe('Frieren');
    expect(language).toHaveBeenCalledTimes(1);
  });
});
