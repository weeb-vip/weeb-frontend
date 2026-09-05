/**
 * One anime record, shared by every show-page story.
 *
 * Not a story file itself (Storybook only collects `*.stories.*`): the show
 * page's sections each want the same record in a slightly different state, and
 * re-typing 60 fields per file is how the states quietly stop matching.
 */

export const EPISODES = Array.from({ length: 28 }, (_, index) => ({
  id: `ep-${index + 1}`,
  episodeNumber: index + 1,
  titleEn: `The Land Where Souls Rest, part ${index + 1}`,
  titleJp: `魂の眠る地 その${index + 1}`,
  airDate: new Date(Date.UTC(2023, 8, 29 + index * 7)).toISOString(),
}));

export const NEWS = [
  {
    id: 'n1',
    title: 'Season 2 confirmed for autumn',
    summary:
      'The official site announced a second season alongside a teaser visual, with the staff returning.',
    category: 'announcement',
    publishedDate: '2024-05-18T09:00:00Z',
    sourceName: 'Official site',
    sourceUrl: 'https://example.com/announcement',
  },
  {
    id: 'n2',
    title: 'Episode 12 delayed a week',
    summary: 'The broadcast slot moves for a sports programme; streaming follows the same schedule.',
    category: 'release',
    episodeNumber: 12,
    publishedDate: '2024-05-02T11:30:00Z',
    sourceName: 'Broadcaster',
    sourceUrl: 'https://example.com/delay',
  },
  {
    id: 'n3',
    title: 'New character designer joins for the second cour',
    category: 'staff',
    publishedDate: '2024-04-11T08:00:00Z',
    sourceName: 'Anime News Network',
    sourceUrl: 'https://example.com/staff',
  },
];

export const RELATED = [
  {
    relation: 'SAME_SERIES',
    anime: {
      id: 'anime-3',
      slug: 'frieren-special',
      titleEn: 'Frieren: The First Journey',
      type: 'Special',
      startDate: '2024-06-14',
      seasonNumber: 0,
    },
  },
];

/**
 * Shape matters here: the API returns CharacterWithStaff, so each row nests the
 * character under `character` rather than spreading its fields at the top. A
 * flat row reads back as `entry.character === undefined` and takes the cast
 * sort down with it.
 */
export const CHARACTERS = {
  charactersAndStaffByAnimeId: [
    {
      character: { id: 'c1', animeId: 'a1', name: 'Frieren', role: 'Main', image: null },
      staff: [{ id: 's1', givenName: 'Atsumi', familyName: 'Tanezaki', language: 'Japanese', image: null }],
    },
    {
      character: { id: 'c2', animeId: 'a1', name: 'Fern', role: 'Main', image: null },
      staff: [{ id: 's2', givenName: 'Kana', familyName: 'Ichinose', language: 'Japanese', image: null }],
    },
  ],
};

/** A finished, fully populated show: every optional field the page can draw. */
export const FULL_ANIME = {
  id: 'a8f45313-b080-4f5a-8d53-5d04e7d2a315',
  slug: 'frieren-beyond-journeys-end',
  titleEn: 'Frieren: Beyond Journey’s End',
  titleJp: '葬送のフリーレン',
  titleRomaji: 'Sousou no Frieren',
  titleSynonyms: ['Frieren at the Funeral', 'Frieren: Beyond Journey’s End'],
  description:
    'The elf mage Frieren outlives the party she saved the world with, and only then starts asking what any of it meant. Ten years of adventuring against a thousand-year life; the journey back over the same road is the story.',
  type: 'TV',
  startDate: '2023-09-29T00:00:00Z',
  endDate: '2024-03-22T00:00:00Z',
  updatedAt: '2024-06-01T00:00:00Z',
  episodeCount: 28,
  duration: '24 min',
  broadcast: 'Fridays at 23:00 (JST)',
  ranking: 1,
  rating: 'PG-13',
  source: 'Manga',
  sourceWork: { urlSlug: 'sousou-no-frieren', titleEn: 'Frieren: Beyond Journey’s End' },
  studios: ['Madhouse'],
  licensors: ['Crunchyroll'],
  tags: ['Adventure', 'Drama', 'Fantasy'],
  seasonNumber: 1,
  thetvdbid: '424536',
  streamingPlatforms: [
    { platform: 'Crunchyroll', name: 'Crunchyroll', url: 'https://crunchyroll.com/frieren' },
    { platform: 'Netflix', name: 'Netflix', url: 'https://netflix.com/title/81726445' },
  ],
  episodes: EPISODES,
  news: NEWS,
  relatedAnime: RELATED,
  userAnime: null as any,
};

/** The same show, on the viewer's list and part way through. */
export const TRACKED_ANIME = {
  ...FULL_ANIME,
  userAnime: { id: 'ua-1', status: 'WATCHING', score: 9, episodes: 11 },
};

/**
 * What most of the catalogue actually looks like: a name, a synopsis, and very
 * little else. No episodes scraped, no news, no series, no streaming rows.
 */
export const MINIMAL_ANIME = {
  id: 'minimal-1',
  slug: 'a-quiet-show',
  titleEn: 'A Quiet Show',
  description: 'A short description, and nothing else recorded against it.',
  type: 'TV',
  startDate: '2019-04-05T00:00:00Z',
  endDate: '2019-06-28T00:00:00Z',
  updatedAt: '2019-07-01T00:00:00Z',
  studios: null,
  tags: [],
  episodes: [],
  news: [],
  relatedAnime: [],
  streamingPlatforms: [],
  userAnime: null as any,
};

/**
 * Announced but not yet broadcast: no end date, no episodes aired, and a
 * broadcast slot that is the only thing the page can say about timing.
 */
export const UNAIRED_ANIME = {
  ...FULL_ANIME,
  id: 'unaired-1',
  slug: 'frieren-s2',
  titleEn: 'Frieren: Beyond Journey’s End Season 2',
  seasonNumber: 2,
  startDate: '2026-01-09T00:00:00Z',
  endDate: null,
  episodeCount: null,
  ranking: null,
  news: [],
  relatedAnime: RELATED,
  episodes: [
    {
      id: 'ep-s2-1',
      episodeNumber: 1,
      titleEn: 'The Road Back',
      titleJp: '帰り道',
      airDate: '2026-01-09T14:00:00Z',
    },
  ],
  userAnime: null as any,
};
