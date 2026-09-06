import { describe, it, expect } from 'vitest';
import { writable, fromStore } from 'svelte/store';
import {
  ROLE_PAGE_SIZE,
  VoiceActorPageBloc,
  isMainRole,
  type RoleEntry,
  type Staff
} from './VoiceActorPage.bloc.svelte';

/**
 * A voice actor's page: their credits, the filter narrowing them, and how much
 * of the list is revealed.
 *
 * The load-bearing rules are the ones that came out of real profiles. Roles are
 * revealed a page at a time because a prolific actor's 117 credits put 234
 * portrait requests behind the browser's six-connections-per-host limit. The
 * counts are over roles rather than over anime, because one title can hold two
 * credits and collapsing them understates the work. The reveal resets with the
 * filter, or switching would keep an expansion nobody asked for over a shorter
 * list. And MyAnimeList writes the role as free text, so "Main", "Main
 * Character" and "Protagonist" all have to mean the same thing.
 */

function role(id: string, name: string, roleText: string | null, anime: any = { id: `anime-${id}` }): RoleEntry {
  return { character: { id, name, role: roleText }, anime };
}

/** `n` credits, alternating main and supporting so both buckets are populated. */
function roles(n: number, roleText: (index: number) => string | null = () => 'Main'): RoleEntry[] {
  return Array.from({ length: n }, (_, index) =>
    role(`c${index}`, `Character ${index}`, roleText(index), { id: `anime-${index}` })
  );
}

function build(staff: Staff | null, { ssrError = null, pageSize }: { ssrError?: string | null; pageSize?: number } = {}) {
  return new VoiceActorPageBloc({ source: () => ({ staff, ssrError }), ...(pageSize ? { pageSize } : {}) });
}

/** The bloc over a payload that can be replaced, as a slug change replaces it. */
function overMutablePayload(initial: { staff: Staff | null; ssrError?: string | null }, pageSize?: number) {
  const store = writable<{ staff: Staff | null; ssrError: string | null }>({
    staff: initial.staff,
    ssrError: initial.ssrError ?? null
  });
  const view = fromStore(store);
  const bloc = new VoiceActorPageBloc({
    source: () => view.current,
    ...(pageSize ? { pageSize } : {})
  });
  return { bloc, setPayload: store.set };
}

describe('what counts as a main role', () => {
  it('matches the words MyAnimeList actually writes', () => {
    expect(isMainRole('Main')).toBe(true);
    expect(isMainRole('Main Character')).toBe(true);
    expect(isMainRole('Protagonist')).toBe(true);
  });

  it('does not care about case', () => {
    expect(isMainRole('MAIN')).toBe(true);
    expect(isMainRole('protagonist')).toBe(true);
  });

  it('is not a main role for anything else', () => {
    expect(isMainRole('Supporting')).toBe(false);
    expect(isMainRole('')).toBe(false);
    expect(isMainRole(null)).toBe(false);
    expect(isMainRole(undefined)).toBe(false);
  });
});

describe('who the page is about', () => {
  it('joins the two halves of the name', () => {
    expect(build({ givenName: 'Aoi', familyName: 'Yuki' }).name).toBe('Aoi Yuki');
  });

  it('does not leave a dangling space when half the name is missing', () => {
    expect(build({ givenName: null, familyName: 'Yuki' }).name).toBe('Yuki');
    expect(build({ givenName: 'Aoi', familyName: null }).name).toBe('Aoi');
  });

  it('is empty rather than "null null" when there is no staff record at all', () => {
    expect(build(null).name).toBe('');
  });

  it('treats a blank scraped summary as no summary', () => {
    // The scrape writes empty strings, not nulls; a falsy check is what stops
    // the page rendering an empty paragraph.
    expect(build({ summary: '' }).summary).toBeNull();
    expect(build({ summary: 'Voices Madoka.' }).summary).toBe('Voices Madoka.');
    expect(build(null).summary).toBeNull();
  });

  it('lists only the profile fields that were filled in', () => {
    const bloc = build({
      language: 'Japanese',
      birthday: '',
      birthPlace: 'Tokyo',
      bloodType: null,
      hobbies: undefined
    });

    expect(bloc.details).toEqual([
      { label: 'Language', value: 'Japanese' },
      { label: 'Birthplace', value: 'Tokyo' }
    ]);
  });

  it('has no detail rows at all for an empty profile', () => {
    expect(build({}).details).toEqual([]);
    expect(build(null).details).toEqual([]);
  });

  it('reports the loader’s failure verbatim', () => {
    expect(build(null, { ssrError: 'GraphQL: staff lookup failed' }).ssrError).toBe(
      'GraphQL: staff lookup failed'
    );
    expect(build({}).ssrError).toBeNull();
  });
});

describe('counting the credits', () => {
  it('counts roles, not anime', () => {
    // A lead and a one-scene bit part in the same title are two credits.
    const bloc = build({
      roles: [
        role('a', 'Lead', 'Main', { id: 'same' }),
        role('b', 'Bit part', 'Supporting', { id: 'same' })
      ]
    });

    expect(bloc.roles).toHaveLength(2);
    expect(bloc.mainCount).toBe(1);
    expect(bloc.supportingCount).toBe(1);
  });

  it('reports the number of distinct anime separately', () => {
    const bloc = build({
      roles: [
        role('a', 'Lead', 'Main', { id: 'same' }),
        role('b', 'Bit part', 'Supporting', { id: 'same' }),
        role('c', 'Other', 'Main', { id: 'other' })
      ]
    });

    expect(bloc.animeCount).toBe(2);
  });

  it('does not count a credit whose anime is gone', () => {
    const bloc = build({
      roles: [role('a', 'Lead', 'Main', null), role('b', 'Other', 'Main', { id: 'kept' })]
    });

    expect(bloc.roles).toHaveLength(2);
    expect(bloc.animeCount).toBe(1);
  });

  it('treats everything that is not main as supporting', () => {
    const bloc = build({
      roles: [role('a', 'A', null), role('b', 'B', ''), role('c', 'C', 'Main')]
    });

    expect(bloc.mainCount).toBe(1);
    expect(bloc.supportingCount).toBe(2);
  });

  it('counts nothing for an actor with no credits', () => {
    const bloc = build({ roles: null });

    expect(bloc.roles).toEqual([]);
    expect(bloc.mainCount).toBe(0);
    expect(bloc.supportingCount).toBe(0);
    expect(bloc.animeCount).toBe(0);
  });
});

describe('the filter strip', () => {
  it('offers each bucket with the number in it', () => {
    const bloc = build({
      roles: [role('a', 'A', 'Main'), role('b', 'B', 'Supporting'), role('c', 'C', 'Supporting')]
    });

    expect(bloc.filterOptions).toEqual([
      { value: 'all', label: 'All', count: 3 },
      { value: 'main', label: 'Main', count: 1 },
      { value: 'supporting', label: 'Supporting', count: 2 }
    ]);
  });

  it('does not offer a bucket with nothing in it', () => {
    const bloc = build({ roles: [role('a', 'A', 'Main')] });

    expect(bloc.filterOptions.map((option) => option.value)).toEqual(['all', 'main']);
  });

  it('is not drawn when there is no choice to make', () => {
    expect(build({ roles: [] }).showFilters).toBe(false);
    expect(build(null).filterOptions).toEqual([]);
    expect(build({ roles: [role('a', 'A', 'Main')] }).showFilters).toBe(true);
  });

  it('starts on "all"', () => {
    expect(build({ roles: [role('a', 'A', 'Main')] }).filter).toBe('all');
  });

  it('narrows to the chosen bucket', () => {
    const bloc = build({
      roles: [role('a', 'A', 'Main'), role('b', 'B', 'Supporting'), role('c', 'C', 'Protagonist')]
    });

    bloc.selectFilter('main');
    expect(bloc.visibleRoles.map((entry) => entry.character.id)).toEqual(['a', 'c']);

    bloc.selectFilter('supporting');
    expect(bloc.visibleRoles.map((entry) => entry.character.id)).toEqual(['b']);

    bloc.selectFilter('all');
    expect(bloc.visibleRoles).toHaveLength(3);
  });

  it('keeps the newest-first order the API already returned', () => {
    // Nothing is re-sorted here, so filtering must not disturb the order.
    const bloc = build({ roles: roles(4, (index) => (index % 2 === 0 ? 'Main' : 'Supporting')) });

    bloc.selectFilter('main');

    expect(bloc.visibleRoles.map((entry) => entry.character.id)).toEqual(['c0', 'c2']);
  });

  it('shows an empty list rather than everything for a bucket with no members', () => {
    const bloc = build({ roles: [role('a', 'A', 'Main')] });

    bloc.selectFilter('supporting');

    expect(bloc.visibleRoles).toEqual([]);
    expect(bloc.remaining).toBe(0);
    expect(bloc.nextRevealSize).toBe(0);
  });

  it('reads an unrecognised filter as "not main"', () => {
    // Current behaviour: `selectFilter` casts whatever the strip hands it, and
    // the comparison is `main ? … : !main`, so anything but 'all' and 'main'
    // behaves as 'supporting'.
    const bloc = build({ roles: [role('a', 'A', 'Main'), role('b', 'B', 'Supporting')] });

    bloc.selectFilter('nonsense');

    expect(bloc.filter).toBe('nonsense');
    expect(bloc.visibleRoles.map((entry) => entry.character.id)).toEqual(['b']);
  });
});

describe('revealing the roles a page at a time', () => {
  it('shows one page by default', () => {
    const bloc = build({ roles: roles(50) });

    expect(ROLE_PAGE_SIZE).toBe(24);
    expect(bloc.visibleRoles).toHaveLength(24);
    expect(bloc.remaining).toBe(26);
  });

  it('does not truncate a list that already fits', () => {
    const bloc = build({ roles: roles(5) });

    expect(bloc.visibleRoles).toHaveLength(5);
    expect(bloc.remaining).toBe(0);
  });

  it('adds exactly one page per reveal', () => {
    const bloc = build({ roles: roles(10) }, { pageSize: 3 });

    expect(bloc.visibleRoles).toHaveLength(3);

    bloc.showMore();

    expect(bloc.visibleRoles).toHaveLength(6);
    expect(bloc.remaining).toBe(4);
  });

  it('says how many the next reveal will add', () => {
    const bloc = build({ roles: roles(5) }, { pageSize: 3 });

    expect(bloc.nextRevealSize).toBe(2); // the tail, not a full page

    bloc.showMore();

    expect(bloc.remaining).toBe(0);
    expect(bloc.nextRevealSize).toBe(0);
  });

  it('stops at the end of the list however often it is asked', () => {
    const bloc = build({ roles: roles(4) }, { pageSize: 3 });

    bloc.showMore();
    bloc.showMore();
    bloc.showMore();

    expect(bloc.visibleRoles).toHaveLength(4);
    expect(bloc.remaining).toBe(0);
  });

  it('folds the list back up when the filter changes', () => {
    // Otherwise switching to a shorter bucket keeps an expansion the reader
    // never asked for, and the whole point of the paging is lost.
    const bloc = build({ roles: roles(20, (index) => (index < 10 ? 'Main' : 'Supporting')) }, { pageSize: 3 });

    bloc.showMore();
    bloc.showMore();
    expect(bloc.visibleRoles).toHaveLength(9);

    bloc.selectFilter('main');

    expect(bloc.visibleRoles).toHaveLength(3);
    expect(bloc.remaining).toBe(7);
  });

  it('folds back up even when the filter is set to the one already active', () => {
    const bloc = build({ roles: roles(20) }, { pageSize: 3 });

    bloc.showMore();
    bloc.selectFilter('all');

    expect(bloc.visibleRoles).toHaveLength(3);
  });
});

describe('a navigation to another actor', () => {
  it('does not leave the previous actor’s credits on the page', () => {
    // SvelteKit reuses one +page.svelte across a param change and the bloc is
    // built once, so every read has to come back through the accessor.
    const { bloc, setPayload } = overMutablePayload({
      staff: { givenName: 'Aoi', familyName: 'Yuki', roles: roles(3) }
    });

    expect(bloc.roles).toHaveLength(3);

    setPayload({
      staff: { givenName: 'Mamoru', familyName: 'Miyano', roles: roles(1) },
      ssrError: null
    });

    expect(bloc.name).toBe('Mamoru Miyano');
    expect(bloc.roles).toHaveLength(1);
    expect(bloc.animeCount).toBe(1);
    expect(bloc.visibleRoles).toHaveLength(1);
  });

  it('clears a stale error when the next actor loads cleanly', () => {
    const { bloc, setPayload } = overMutablePayload({ staff: null, ssrError: 'GraphQL: boom' });

    expect(bloc.ssrError).toBe('GraphQL: boom');

    setPayload({ staff: { givenName: 'Aoi', roles: [] }, ssrError: null });

    expect(bloc.ssrError).toBeNull();
    expect(bloc.roles).toEqual([]);
  });

  it('keeps the filter and the reveal across the change', () => {
    // Current behaviour, and a bug worth naming: `#filter` and `#visibleCount`
    // live in the bloc, the route has no `{#key}`, and nothing resets them on a
    // param change. Arriving at a new actor from a "Supporting" view lands on
    // "Supporting" with two pages already open.
    const { bloc, setPayload } = overMutablePayload(
      { staff: { roles: roles(20, (index) => (index < 10 ? 'Main' : 'Supporting')) } },
      3
    );

    bloc.selectFilter('supporting');
    bloc.showMore();
    expect(bloc.filter).toBe('supporting');
    expect(bloc.visibleRoles).toHaveLength(6);

    setPayload({
      staff: { roles: roles(20, (index) => (index < 10 ? 'Main' : 'Supporting')) },
      ssrError: null
    });

    expect(bloc.filter).toBe('supporting');
    expect(bloc.visibleRoles).toHaveLength(6);
  });
});

describe('links off a credit', () => {
  it('prefers the slug and falls back to the id', () => {
    const bloc = build(null);

    expect(bloc.hrefFor({ id: 'abc', slug: 'madoka-magica' })).toBe('/anime/madoka-magica');
    expect(bloc.hrefFor({ id: 'abc' })).toBe('/anime/abc');
  });

  it('escapes an id that is not URL-safe', () => {
    expect(build(null).hrefFor({ id: 'a b/c' })).toBe('/anime/a%20b%2Fc');
  });

  it('goes home rather than to a broken URL when the anime is gone', () => {
    expect(build(null).hrefFor({})).toBe('/');
  });

  it('prints the year in UTC, or says it does not know', () => {
    const bloc = build(null);

    expect(bloc.yearFor({ startDate: '2011-01-07T00:00:00Z' })).toBe('2011');
    expect(bloc.yearFor({ startDate: null })).toBe('TBA');
    expect(bloc.yearFor(undefined as unknown as { startDate?: string | null })).toBe('TBA');
  });

  it('exposes the main-role rule the cards mark with', () => {
    const bloc = build(null);

    expect(bloc.isMain('Main')).toBe(true);
    expect(bloc.isMain('Supporting')).toBe(false);
  });
});

describe('empty and missing payloads', () => {
  it('renders an empty page rather than throwing when the loader sent nothing', () => {
    const bloc = build(null);

    expect(bloc.staff).toBeNull();
    expect(bloc.roles).toEqual([]);
    expect(bloc.visibleRoles).toEqual([]);
    expect(bloc.remaining).toBe(0);
    expect(bloc.showFilters).toBe(false);
  });

  it('starts from no staff at all when constructed with no ports', () => {
    const bloc = new VoiceActorPageBloc();

    expect(bloc.staff).toBeNull();
    expect(bloc.ssrError).toBeNull();
    expect(bloc.roles).toEqual([]);
    expect(bloc.filter).toBe('all');
  });

  it('survives a credit with no character name or role', () => {
    const bloc = build({ roles: [{ character: {} } as RoleEntry] });

    expect(bloc.roles).toHaveLength(1);
    expect(bloc.mainCount).toBe(0);
    expect(bloc.supportingCount).toBe(1);
    expect(bloc.animeCount).toBe(0);
  });
});
