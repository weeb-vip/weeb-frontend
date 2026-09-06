import { describe, it, expect } from 'vitest';
import { readable, writable } from 'svelte/store';
import { PublicUserPageBloc, type PublicUserSource } from './PublicUserPage.bloc.svelte';
import { ACCENT_OPTIONS } from '$lib/utils/accents';

/**
 * Someone else's profile at /u/<username>.
 *
 * Two rules carry this page. The first is the privacy gate: the loader attaches
 * no list data at all for a private profile, so every list-shaped getter has to
 * read as "nothing here" rather than as "still loading" -- there is no second
 * request coming. The second is that the bloc holds no copy of the payload: it
 * calls `source()` on every read, which is what stops /u/ada's numbers from
 * surviving a client-side navigation to /u/grace.
 */

const STAGING = 'https://cdn.weeb.vip/weeb-user-staging';

/** A source over a mutable local, so a param change is a single assignment. */
function payloadSource(initial: { user: any; lists?: any }) {
  let current = initial;
  const source: PublicUserSource = () => ({ user: current.user, lists: current.lists ?? null });
  return { source, set: (next: { user: any; lists?: any }) => (current = next) };
}

function bloc(payload: { user: any; lists?: any }, config: any = readable({ cdn_user_url: 'https://cdn.example' })) {
  return new PublicUserPageBloc({ source: payloadSource(payload).source, config });
}

const ada = {
  id: 'u1',
  username: 'ada',
  firstname: 'Ada',
  lastname: 'Lovelace',
  bio: 'counts things',
  listsPublic: true,
  accentColor: 'violet',
  profileImageUrl: 'ada.png',
  bannerImageUrl: 'ada-banner.jpg',
};

describe('the header, which is public whatever the lists are', () => {
  it('reads the username straight off the loader row', () => {
    expect(bloc({ user: ada }).username).toBe('ada');
  });

  it('prefers a real name over the handle', () => {
    expect(bloc({ user: ada }).displayName).toBe('Ada Lovelace');
  });

  it('falls back to the handle when no name is set', () => {
    expect(bloc({ user: { username: 'grace' } }).displayName).toBe('grace');
  });

  it('uses a first name alone rather than an empty line', () => {
    expect(bloc({ user: { username: 'grace', firstname: 'Grace' } }).displayName).toBe('Grace');
    expect(bloc({ user: { username: 'grace', lastname: 'Hopper' } }).displayName).toBe('Hopper');
  });

  it('ignores whitespace-only names', () => {
    // A name of spaces would otherwise beat the handle and render as nothing.
    expect(bloc({ user: { username: 'grace', firstname: '   ' } }).displayName).toBe('grace');
  });

  it('says "User" when there is no user at all', () => {
    expect(bloc({ user: null }).displayName).toBe('User');
  });

  it('builds initials from both names', () => {
    expect(bloc({ user: ada }).initials).toBe('AL');
  });

  it('builds initials from the handle when there is no name', () => {
    expect(bloc({ user: { username: 'grace' } }).initials).toBe('G');
  });

  it('falls back to a single question mark rather than an empty avatar', () => {
    expect(bloc({ user: null }).initials).toBe('?');
    expect(bloc({ user: {} }).initials).toBe('?');
  });

  it('uppercases initials taken from a lowercase handle', () => {
    expect(bloc({ user: { username: 'zoe', lastname: 'quinn' } }).initials).toBe('ZQ');
  });

  it('has an empty bio rather than an undefined one', () => {
    expect(bloc({ user: { username: 'grace' } }).bio).toBe('');
    expect(bloc({ user: null }).bio).toBe('');
  });

  it('carries the bio through as written', () => {
    expect(bloc({ user: ada }).bio).toBe('counts things');
  });
});

describe('the accent the viewed user picked', () => {
  it('resolves a stored token to the colour the picker offers', () => {
    const violet = ACCENT_OPTIONS.find((option) => option.name === 'violet')!.value;

    expect(bloc({ user: ada }).accentStyle).toBe(`--weeb-accent: ${violet};`);
  });

  it('scopes it to --weeb-accent, so nothing global is retinted', () => {
    expect(bloc({ user: ada }).accentStyle.startsWith('--weeb-accent:')).toBe(true);
  });

  it('writes no style at all for a user who picked nothing', () => {
    expect(bloc({ user: { username: 'grace' } }).accentStyle).toBe('');
    expect(bloc({ user: null }).accentStyle).toBe('');
  });

  it('writes no style for a token that names nothing we offer', () => {
    // The stored value is a token, never a colour, so a page can only theme
    // itself from the list -- `red; background: url(...)` resolves to nothing.
    expect(bloc({ user: { accentColor: 'chartreuse' } }).accentStyle).toBe('');
    expect(bloc({ user: { accentColor: 'red; background: black' } }).accentStyle).toBe('');
  });
});

describe('the CDN images', () => {
  it('builds both URLs off the configured base', () => {
    const bound = bloc({ user: ada });

    expect(bound.avatarUrl).toBe('https://cdn.example/ada.png');
    expect(bound.bannerUrl).toBe('https://cdn.example/ada-banner.jpg');
  });

  it('is null, not a dangling slash, when the user uploaded nothing', () => {
    const bound = bloc({ user: { username: 'grace' } });

    expect(bound.avatarUrl).toBeNull();
    expect(bound.bannerUrl).toBeNull();
  });

  it('is null when there is no user', () => {
    const bound = bloc({ user: null });

    expect(bound.avatarUrl).toBeNull();
    expect(bound.bannerUrl).toBeNull();
  });

  it('falls back to staging while the config store is still empty', () => {
    const bound = bloc({ user: ada }, readable(null));

    expect(bound.avatarUrl).toBe(`${STAGING}/ada.png`);
  });

  it('survives a config store that yields undefined', () => {
    const bound = bloc({ user: ada }, readable(undefined));

    expect(bound.avatarUrl).toBe(`${STAGING}/ada.png`);
  });

  it('picks up the real base the moment the layout hydrates the store', () => {
    // The staging fallback only ever shows for the instant before hydration;
    // it must not be latched.
    const config = writable<any>(null);
    const bound = bloc({ user: ada }, config);
    expect(bound.bannerUrl).toBe(`${STAGING}/ada-banner.jpg`);

    config.set({ cdn_user_url: 'https://cdn.weeb.vip/weeb-user' });

    expect(bound.bannerUrl).toBe('https://cdn.weeb.vip/weeb-user/ada-banner.jpg');
  });

  it('treats a blank configured base as no base at all', () => {
    const bound = bloc({ user: ada }, readable({ cdn_user_url: '' }));

    expect(bound.avatarUrl).toBe(`${STAGING}/ada.png`);
  });
});

describe('the privacy gate', () => {
  it('is public only when the loader row says so', () => {
    expect(bloc({ user: ada, lists: {} }).isPublic).toBe(true);
    expect(bloc({ user: { ...ada, listsPublic: false } }).isPublic).toBe(false);
    expect(bloc({ user: { username: 'grace' } }).isPublic).toBe(false);
    expect(bloc({ user: null }).isPublic).toBe(false);
  });

  it('shows no numbers for a private profile', () => {
    // Even if list data somehow rode along, the gate is read off the user row.
    const bound = bloc({
      user: { ...ada, listsPublic: false },
      lists: { animeCounts: { watching: 9 }, workCounts: { reading: 3 } },
    });

    expect(bound.stats).toEqual([]);
  });

  it('shows no rows for a private profile, because the loader attached none', () => {
    const bound = bloc({ user: { ...ada, listsPublic: false }, lists: null });

    expect(bound.watching).toEqual([]);
    expect(bound.reading).toEqual([]);
  });
});

describe('the watching shelf', () => {
  const entry = {
    id: 'ua1',
    status: 'WATCHING',
    anime: {
      id: 'a1',
      slug: 'frieren',
      titleEn: 'Frieren',
      titleJp: 'Sousou no Frieren',
      animeStatus: 'FINISHED',
      episodeCount: 28,
      tags: ['Adventure', 'Fantasy'],
      description: 'a long walk',
    },
  };
  const listed = (rows: any[]) => bloc({ user: ada, lists: { watching: { animes: rows } } }).watching;

  it('maps an entry onto exactly the card the poster wall wants', () => {
    expect(listed([entry])[0]).toEqual({
      key: 'ua1',
      id: 'a1',
      slug: 'frieren',
      title: 'Frieren',
      image: 'a1',
      status: 'FINISHED',
      sub: '28 episodes',
      genres: ['Adventure', 'Fantasy'],
      description: 'a long walk',
      episodeCount: 28,
      onList: 'WATCHING',
    });
  });

  it('keys on the list-entry id, not the anime id', () => {
    // Two entries can point at the same anime across statuses; the row id is
    // what is unique.
    expect(listed([entry, { ...entry, id: 'ua2' }]).map((card) => card.key)).toEqual(['ua1', 'ua2']);
  });

  it('coerces a numeric id into a string key', () => {
    expect(listed([{ ...entry, id: 7 }])[0].key).toBe('7');
  });

  it('falls back to the Japanese title, then to Untitled', () => {
    expect(listed([{ ...entry, anime: { id: 'a1', titleJp: 'Sousou' } }])[0].title).toBe('Sousou');
    expect(listed([{ ...entry, anime: { id: 'a1' } }])[0].title).toBe('Untitled');
    expect(listed([{ ...entry, anime: null }])[0].title).toBe('Untitled');
  });

  it('leaves the sub-line empty rather than printing "0 episodes"', () => {
    expect(listed([{ ...entry, anime: { ...entry.anime, episodeCount: 0 } }])[0].sub).toBe('');
    expect(listed([{ ...entry, anime: { ...entry.anime, episodeCount: null } }])[0].sub).toBe('');
  });

  it('defaults a missing status to watching, since that is the shelf', () => {
    expect(listed([{ ...entry, status: null }])[0].onList).toBe('watching');
  });

  it('gives an entry with no anime empty rather than undefined fields', () => {
    const card = listed([{ id: 'ua9', status: 'WATCHING', anime: null }])[0];

    expect(card.id).toBe('');
    expect(card.image).toBe('');
    expect(card.genres).toEqual([]);
    expect(card.description).toBe('');
  });

  it('is empty, not undefined, for a public user with nothing on the shelf', () => {
    // An empty public list is a real answer.
    expect(listed([])).toEqual([]);
    expect(bloc({ user: ada, lists: { watching: null } }).watching).toEqual([]);
    expect(bloc({ user: ada, lists: {} }).watching).toEqual([]);
    expect(bloc({ user: ada, lists: { watching: { animes: null } } }).watching).toEqual([]);
  });
});

describe('the reading shelf', () => {
  const entry = {
    id: 'uw1',
    status: 'READING',
    work: {
      id: 'w1',
      titleEn: 'Vinland Saga',
      titleJp: 'Vinrando Saga',
      score: 8.9,
      type: 'MANGA',
      publishedFrom: '2005-04-13T00:00:00Z',
      urlSlug: 'vinland-saga',
    },
  };
  const listed = (rows: any[]) => bloc({ user: ada, lists: { reading: { works: rows } } }).reading;

  it('maps a work onto its card, subtitle and manga link', () => {
    expect(listed([entry])[0]).toEqual({
      key: 'uw1',
      id: 'w1',
      title: 'Vinland Saga',
      image: 'w1',
      imagePath: 'works',
      score: 8.9,
      sub: 'Manga · 2005',
      href: '/manga/vinland-saga',
      onList: 'READING',
    });
  });

  it('sends a work with no slug to search rather than to a broken route', () => {
    expect(listed([{ ...entry, work: { ...entry.work, urlSlug: null } }])[0].href).toBe('/search');
  });

  it('keeps an unrecognised kind rather than dropping the subtitle', () => {
    // The wire value is a free string; MyAnimeList adds kinds without warning.
    expect(listed([{ ...entry, work: { ...entry.work, type: 'WEB_MANHWA' } }])[0].sub).toBe(
      'Web manhwa · 2005',
    );
  });

  it('drops the year from the subtitle when the date is unusable', () => {
    expect(listed([{ ...entry, work: { ...entry.work, publishedFrom: 'not a date' } }])[0].sub).toBe(
      'Manga',
    );
    expect(listed([{ ...entry, work: { ...entry.work, publishedFrom: null } }])[0].sub).toBe('Manga');
  });

  it('has a null score rather than an undefined one', () => {
    expect(listed([{ ...entry, work: { ...entry.work, score: undefined } }])[0].score).toBeNull();
  });

  it('keeps a zero score, which is a score', () => {
    expect(listed([{ ...entry, work: { ...entry.work, score: 0 } }])[0].score).toBe(0);
  });

  it('defaults a missing status to reading, since that is the shelf', () => {
    expect(listed([{ ...entry, status: null }])[0].onList).toBe('reading');
  });

  it('is empty for a public user who is reading nothing', () => {
    expect(listed([])).toEqual([]);
    expect(bloc({ user: ada, lists: { reading: { works: null } } }).reading).toEqual([]);
  });
});

describe('the header numbers', () => {
  const counted = (animeCounts: any, workCounts: any) =>
    bloc({ user: ada, lists: { animeCounts, workCounts } }).stats;

  it('reports each status and the sum of both libraries', () => {
    expect(
      counted(
        { watching: 3, planToWatch: 10, completed: 42, onHold: 1, dropped: 2 },
        { reading: 4, planToRead: 5, completed: 7, onHold: 0, dropped: 1 },
      ),
    ).toEqual([
      { label: 'Tracked', value: 75 },
      { label: 'Watching', value: 3 },
      { label: 'Anime done', value: 42 },
      { label: 'Reading', value: 4 },
      { label: 'Manga done', value: 7 },
    ]);
  });

  it('adds Int64 counts that arrive as strings instead of concatenating them', () => {
    // These are Int64 scalars, so gqlgen marshals them as JSON strings; left
    // alone the total would read "3102" rather than 13.
    const stats = counted({ watching: '3', planToWatch: '10' }, { reading: '0' });

    expect(stats[0].value).toBe(13);
    expect(stats[1].value).toBe(3);
  });

  it('counts an unparseable value as zero rather than poisoning the sum with NaN', () => {
    const stats = counted({ watching: 'lots', completed: 5 }, null);

    expect(stats[0].value).toBe(5);
    expect(stats[1].value).toBe(0);
  });

  it('is all zeroes for a public user whose library is empty', () => {
    // Empty is a real answer; the tiles still render, showing nothing tracked.
    expect(counted({}, {}).map((stat) => stat.value)).toEqual([0, 0, 0, 0, 0]);
  });

  it('is all zeroes when the count queries came back null', () => {
    expect(counted(null, null).map((stat) => stat.value)).toEqual([0, 0, 0, 0, 0]);
    expect(bloc({ user: ada, lists: {} }).stats.map((stat) => stat.value)).toEqual([0, 0, 0, 0, 0]);
  });

  it('counts one library when only the other is missing', () => {
    expect(counted({ watching: 2, completed: 3 }, null)[0].value).toBe(5);
    expect(counted(null, { reading: 2, completed: 3 })[0].value).toBe(5);
  });

  it('ignores count keys that belong to the other medium', () => {
    // planToRead on the anime counts is not an anime status; counting it would
    // double a manga number into the anime total.
    expect(counted({ watching: 1, planToRead: 99 }, { reading: 1 })[0].value).toBe(2);
  });
});

describe('keying on the username', () => {
  it('reads the payload on every access rather than latching it', () => {
    const { source, set } = payloadSource({ user: ada, lists: null });
    const bound = new PublicUserPageBloc({ source, config: readable(null) });
    expect(bound.username).toBe('ada');

    set({ user: { username: 'grace', firstname: 'Grace', listsPublic: false } });

    expect(bound.username).toBe('grace');
    expect(bound.displayName).toBe('Grace');
    expect(bound.isPublic).toBe(false);
  });

  it('does not leak the previous user\'s rows across a param change', () => {
    // A client-side navigation from /u/ada to /u/grace reuses this instance;
    // a cached shelf would show one person's library under another's name.
    const { source, set } = payloadSource({
      user: ada,
      lists: { watching: { animes: [{ id: 'ua1', anime: { id: 'a1', titleEn: 'Frieren' } }] } },
    });
    const bound = new PublicUserPageBloc({ source, config: readable(null) });
    expect(bound.watching).toHaveLength(1);

    set({ user: { username: 'grace', listsPublic: true }, lists: { watching: { animes: [] } } });

    expect(bound.watching).toEqual([]);
  });

  it('does not leak the previous user\'s numbers either', () => {
    const { source, set } = payloadSource({
      user: ada,
      lists: { animeCounts: { watching: 12 }, workCounts: null },
    });
    const bound = new PublicUserPageBloc({ source, config: readable(null) });
    expect(bound.stats[1].value).toBe(12);

    set({ user: { username: 'grace', listsPublic: true }, lists: null });

    expect(bound.stats[1].value).toBe(0);
  });

  it('closes the shelves when the next profile is a private one', () => {
    const { source, set } = payloadSource({
      user: ada,
      lists: { watching: { animes: [{ id: 'ua1', anime: { id: 'a1' } }] }, animeCounts: { watching: 1 } },
    });
    const bound = new PublicUserPageBloc({ source, config: readable(null) });
    expect(bound.stats).not.toEqual([]);

    set({ user: { username: 'grace', listsPublic: false }, lists: null });

    expect(bound.isPublic).toBe(false);
    expect(bound.stats).toEqual([]);
    expect(bound.watching).toEqual([]);
  });

  it('reads as an empty page rather than throwing when there is no user row', () => {
    // The loader 404s before this, but the default source is exactly this
    // shape, so every getter has to survive it.
    const bound = new PublicUserPageBloc();

    expect(bound.user).toBeNull();
    expect(bound.username).toBe('');
    expect(bound.isPublic).toBe(false);
    expect(bound.stats).toEqual([]);
    expect(bound.watching).toEqual([]);
    expect(bound.reading).toEqual([]);
    expect(bound.accentStyle).toBe('');
  });
});
