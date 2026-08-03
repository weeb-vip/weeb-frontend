import {
  animeSchema,
  breadcrumbSchema,
  isoDuration,
  serializeJsonLd
} from './structured-data';

const CANON = 'https://weeb.vip/show/bd4134c1';
const IMG = 'https://weeb.vip/og/bd4134c1';

const FULL = {
  titleEn: 'I Became a Legend After My 10 Year-Long Last Stand.',
  titleJp: 'ここは俺に任せて先に行けと言ってから10年がたったら伝説になっていた。',
  titleRomaji: null,
  description: 'The sorcerer Luck believes this to be the end.',
  episodeCount: 12,
  startDate: '2026-07-06T04:00:00Z',
  endDate: null,
  duration: '23 min. per ep.',
  tags: ['Action', 'Fantasy', 'Adventure'],
  studios: ['Gekkou'],
  malId: 62617
};

describe('isoDuration', () => {
  it('converts the API format', () => {
    expect(isoDuration('23 min. per ep.')).toBe('PT23M');
    expect(isoDuration('1 hr. 45 min.')).toBe('PT1H45M');
  });

  it('drops anything unparseable rather than guessing', () => {
    expect(isoDuration('unknown')).toBeNull();
    expect(isoDuration('')).toBeNull();
    expect(isoDuration(null)).toBeNull();
  });
});

describe('animeSchema', () => {
  it('builds a TVSeries from what the page already has', () => {
    const s = animeSchema(FULL, CANON, IMG)!;

    expect(s['@context']).toBe('https://schema.org');
    expect(s['@type']).toBe('TVSeries');
    expect(s.name).toBe(FULL.titleEn);
    expect(s.alternateName).toBe(FULL.titleJp);
    expect(s.numberOfEpisodes).toBe(12);
    expect(s.genre).toEqual(['Action', 'Fantasy', 'Adventure']);
    expect(s.productionCompany).toEqual([{ '@type': 'Organization', name: 'Gekkou' }]);
    expect(s.timeRequired).toBe('PT23M');
    expect(s.url).toBe(CANON);
    expect(s.image).toBe(IMG);
  });

  it('emits a date, not a timestamp', () => {
    // Same reasoning as sitemap lastmod: no zone is given, so claim only the date.
    expect(animeSchema(FULL, CANON, IMG)!.startDate).toBe('2026-07-06');
  });

  it('links to MyAnimeList, because titles are not unique', () => {
    // 2,301 anime in the catalogue share a title with another; malId disambiguates.
    expect(animeSchema(FULL, CANON, IMG)!.sameAs).toBe('https://myanimelist.net/anime/62617');
  });

  it('treats a single-episode entry as a Movie with no episode count', () => {
    const s = animeSchema({ ...FULL, episodeCount: 1 }, CANON, IMG)!;

    expect(s['@type']).toBe('Movie');
    expect(s).not.toHaveProperty('numberOfEpisodes');
  });

  it('never emits aggregateRating or contentRating', () => {
    // `rating` is a MAL score ("6.7"), not a content advisory, and Google rejects
    // aggregateRating with no ratingCount — which the API does not provide.
    const s = animeSchema({ ...FULL, ...({ rating: '6.7' } as any) }, CANON, IMG)!;

    expect(s).not.toHaveProperty('aggregateRating');
    expect(s).not.toHaveProperty('contentRating');
  });

  it('omits empty fields instead of emitting nulls', () => {
    const s = animeSchema(
      { titleEn: 'Bare', description: null, tags: [], studios: [], malId: null },
      CANON,
      IMG
    )!;

    expect(s).not.toHaveProperty('description');
    expect(s).not.toHaveProperty('genre');
    expect(s).not.toHaveProperty('productionCompany');
    expect(s).not.toHaveProperty('sameAs');
    expect(s.name).toBe('Bare');
  });

  it('falls back to the Japanese title, and does not repeat it as an alternate', () => {
    const s = animeSchema({ titleEn: null, titleJp: '進撃の巨人' }, CANON, IMG)!;

    expect(s.name).toBe('進撃の巨人');
    expect(s).not.toHaveProperty('alternateName');
  });

  it('returns null when there is no title at all', () => {
    expect(animeSchema({ titleEn: null, titleJp: null }, CANON, IMG)).toBeNull();
  });
});

describe('breadcrumbSchema', () => {
  it('numbers positions from 1', () => {
    const s = breadcrumbSchema([
      { name: 'Home', url: 'https://weeb.vip/' },
      { name: 'Show', url: CANON }
    ])!;

    expect(s['@type']).toBe('BreadcrumbList');
    expect(s.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://weeb.vip/' },
      { '@type': 'ListItem', position: 2, name: 'Show', item: CANON }
    ]);
  });

  it('returns null for an empty trail', () => {
    expect(breadcrumbSchema([])).toBeNull();
  });
});

describe('serializeJsonLd', () => {
  it('escapes < so a description cannot break out of the script tag', () => {
    const out = serializeJsonLd({ description: '</script><script>alert(1)</script>' });

    expect(out).not.toContain('</script>');
    expect(out).toContain('\\u003c');
    expect(JSON.parse(out).description).toBe('</script><script>alert(1)</script>');
  });
});
