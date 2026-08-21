import {
  animeSchema,
  breadcrumbSchema,
  episodeSchemas,
  inferLanguage,
  isoDuration,
  itemListSchema,
  serializeJsonLd
} from './structured-data';

const CANON = 'https://weeb.vip/anime/some-anime';
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

describe('inferLanguage', () => {
  it('reads the script of the native title', () => {
    expect(inferLanguage({ titleJp: 'ぼっち・ざ・ろっく！' })).toBe('ja');
    expect(inferLanguage({ titleJp: '나 혼자만 레벨업' })).toBe('ko');
    expect(inferLanguage({ titleJp: '斗罗大陆' })).toBe('zh');
  });

  it('falls back to Japanese when there is no native title to read', () => {
    expect(inferLanguage({ titleEn: 'Some Anime' })).toBe('ja');
  });

  it('uses titleKanji when titleJp is absent', () => {
    expect(inferLanguage({ titleKanji: '鋼の錬金術師' })).toBe('ja');
  });
});

describe('episodeSchemas', () => {
  const NOW = new Date('2026-08-19T00:00:00Z');

  const EPS = [
    { episodeNumber: 2, titleEn: 'Second', airDate: '2026-08-12T15:00:00Z' },
    { episodeNumber: 1, titleEn: 'First', airDate: '2026-08-05T15:00:00Z' },
    { episodeNumber: 3, titleEn: 'Third', airDate: '2026-08-26T15:00:00Z' }
  ];

  it('orders by episode number regardless of input order', () => {
    expect(episodeSchemas(EPS, NOW).map((e) => e.episodeNumber)).toEqual([1, 2, 3]);
  });

  it('only claims datePublished for episodes that have aired', () => {
    const [first, , third] = episodeSchemas(EPS, NOW);
    expect(first.datePublished).toBe('2026-08-05');
    expect(third.datePublished).toBeUndefined();
  });

  it('carries the scheduled time on future episodes as a BroadcastEvent', () => {
    const [, , third] = episodeSchemas(EPS, NOW);
    expect(third.publication).toEqual({
      '@type': 'BroadcastEvent',
      startDate: '2026-08-26',
      isLiveBroadcast: false
    });
  });

  it('keeps the most recent episodes when a long-runner exceeds the cap', () => {
    const many = Array.from({ length: 250 }, (_, i) => ({
      episodeNumber: i + 1,
      titleEn: `Ep ${i + 1}`,
      airDate: '2020-01-01T00:00:00Z'
    }));
    const out = episodeSchemas(many, NOW);
    expect(out).toHaveLength(100);
    expect(out[0].episodeNumber).toBe(151);
    expect(out[99].episodeNumber).toBe(250);
  });

  it('drops episodes with no number rather than guessing one', () => {
    expect(episodeSchemas([{ titleEn: 'Special', airDate: null }], NOW)).toEqual([]);
  });

  it('is empty for no episodes', () => {
    expect(episodeSchemas(null, NOW)).toEqual([]);
    expect(episodeSchemas([], NOW)).toEqual([]);
  });
});

describe('itemListSchema', () => {
  const OPTS = {
    name: 'Summer 2026 Anime',
    url: 'https://weeb.vip/season/SUMMER_2026',
    siteUrl: 'https://weeb.vip'
  };

  const ITEMS = [
    { slug: 'first-show', titleEn: 'First Show', imageUrl: 'https://cdn/1.jpg' },
    { slug: 'second-show', titleEn: null, titleJp: '二番目' }
  ];

  it('builds positioned entries pointing at canonical show URLs', () => {
    const list = itemListSchema(ITEMS, OPTS)!;

    expect(list['@type']).toBe('ItemList');
    expect(list.numberOfItems).toBe(2);
    expect(list.itemListElement).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        url: 'https://weeb.vip/anime/first-show',
        name: 'First Show',
        image: 'https://cdn/1.jpg'
      },
      {
        '@type': 'ListItem',
        position: 2,
        url: 'https://weeb.vip/anime/second-show',
        name: '二番目'
      }
    ]);
  });

  it('drops entries with no slug rather than linking a redirect', () => {
    const list = itemListSchema([{ titleEn: 'No Slug' }, ITEMS[0]], OPTS)!;
    expect(list.numberOfItems).toBe(1);
    expect((list.itemListElement as any[])[0].position).toBe(1);
  });

  it('is null when there is nothing to list', () => {
    expect(itemListSchema([], OPTS)).toBeNull();
    expect(itemListSchema(null, OPTS)).toBeNull();
    expect(itemListSchema([{ titleEn: 'No Slug' }], OPTS)).toBeNull();
  });
});
