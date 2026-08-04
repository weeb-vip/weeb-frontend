import { metaDescription } from './meta';

// The real synopsis that exposed every one of these problems in production.
const REAL = `The sorcerer Luck believes this to be the end. Besieged by powerful demons, he makes the noble sacrifice of holding back their onslaught while his friends escape.

Following his triumph, Luck soon reunites with his friends.

[Written by MAL Rewrite]`;

describe('metaDescription', () => {
  it('never cuts mid-word', () => {
    const out = metaDescription(REAL)!;
    // Everything before the ellipsis must be whole words.
    const body = out.replace(/…$/, '');
    expect(REAL.replace(/\s+/g, ' ')).toContain(body);
    expect(body.endsWith(' ')).toBe(false);
  });

  it('collapses the newlines that leaked into the meta tag', () => {
    expect(metaDescription(REAL)).not.toMatch(/[\n\r]/);
  });

  it('strips the MyAnimeList attribution', () => {
    expect(metaDescription(REAL, 500)).not.toContain('[Written by MAL Rewrite]');
    expect(metaDescription('Short one. [Source: ANN]', 500)).toBe('Short one.');
  });

  it('adds no ellipsis when nothing was removed', () => {
    expect(metaDescription('A complete sentence.')).toBe('A complete sentence.');
    expect(metaDescription('A complete sentence.')).not.toContain('…');
  });

  it('respects the length budget', () => {
    const out = metaDescription(REAL, 160)!;
    expect(out.length).toBeLessThanOrEqual(161); // 160 + the ellipsis character
  });

  it('does not leave dangling punctuation before the ellipsis', () => {
    // Cutting right after a comma used to give "…the end,…"
    const out = metaDescription('one two three, four five six seven', 15)!;
    expect(out).not.toMatch(/[,\s]…$/);
    expect(out.endsWith('…')).toBe(true);
  });

  it('hard-cuts rather than returning nothing for one enormous word', () => {
    const out = metaDescription('x'.repeat(400), 160)!;
    expect(out.length).toBe(161);
  });

  it('returns null for empty or missing input', () => {
    expect(metaDescription(null)).toBeNull();
    expect(metaDescription(undefined)).toBeNull();
    expect(metaDescription('')).toBeNull();
    expect(metaDescription('   ')).toBeNull();
  });
});
