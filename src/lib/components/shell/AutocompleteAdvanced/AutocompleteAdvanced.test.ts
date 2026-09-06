import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  AutocompleteAdvancedBloc,
  hrefForHit,
  searchHref,
  type AutocompleteAdvancedDeps,
  type SearchCollection,
  type SearchPort,
  type SearchState
} from './AutocompleteAdvanced.bloc.svelte';

/**
 * The header search: the grouped results, the roving highlight across them,
 * and what choosing a result does.
 */

const anime = (id: string, title = id) => ({ id, title_en: title, slug: title });
const work = (id: string, slug: string | null) => ({ id, title_en: id, url_slug: slug, __kind: 'work' });

const collection = (sourceId: string, items: unknown[]): SearchCollection => ({
  source: { sourceId },
  items
});

/** A search port whose session the test drives, standing in for Algolia. */
function searchPort(available = true) {
  let push: ((state: SearchState) => void) | null = null;
  const session = {
    setQuery: vi.fn(),
    refresh: vi.fn(),
    setIsOpen: vi.fn()
  };

  const port: SearchPort = {
    connect: async (onState) => {
      push = onState;
      return available ? session : null;
    }
  };

  return {
    port,
    session,
    /** Algolia answered. */
    report(state: Partial<SearchState>) {
      push?.({ query: '', isOpen: true, collections: [], ...state });
    }
  };
}

function makeBloc(deps: Partial<AutocompleteAdvancedDeps> = {}) {
  const navigate = vi.fn();
  const analytics = { searchPerformed: vi.fn() };
  const search = searchPort();
  const bloc = new AutocompleteAdvancedBloc({
    search: search.port,
    navigate,
    analytics,
    dismissDelayMs: 0,
    ...deps
  });
  return { bloc, navigate, analytics, search };
}

afterEach(() => vi.useRealTimers());

describe('hrefForHit', () => {
  it('sends an anime hit to its slug, falling back to its id', () => {
    expect(hrefForHit(anime('a1', 'frieren'))).toBe('/anime/frieren');
    expect(hrefForHit({ id: 'a1' })).toBe('/anime/a1');
  });

  it('sends a work hit to the manga route', () => {
    expect(hrefForHit(work('w1', 'berserk'))).toBe('/manga/berserk');
  });

  it('leaves a work with no slug alone rather than sending it to a certain 404', () => {
    // workBySlug is the only lookup the schema exposes, so there is no
    // id-based route to fall back on.
    expect(hrefForHit(work('w1', null))).toBeNull();
  });

  it('reads url_slug, which is how Algolia stores the CDC payload', () => {
    expect(hrefForHit({ id: 'a1', url_slug: 'frieren' })).toBe('/anime/frieren');
  });
});

describe('searchHref', () => {
  it('encodes the query', () => {
    expect(searchHref('one piece')).toBe('/search?query=one%20piece');
    expect(searchHref('a&b')).toBe('/search?query=a%26b');
  });
});

describe('AutocompleteAdvancedBloc', () => {
  describe('connecting', () => {
    it('draws the skeleton until the backend answers', () => {
      expect(makeBloc().bloc.status).toBe('loading');
    });

    it('is ready once connected', async () => {
      const { bloc } = makeBloc();

      await bloc.init();

      expect(bloc.status).toBe('ready');
    });

    it('degrades to a plain input when search is unavailable', async () => {
      const { bloc } = makeBloc({ search: searchPort(false).port });

      await bloc.init();

      expect(bloc.status).toBe('unavailable');
    });

    it('connects once however many times the view asks', async () => {
      const connect = vi.fn(async () => ({
        setQuery: vi.fn(),
        refresh: vi.fn(),
        setIsOpen: vi.fn()
      }));
      const { bloc } = makeBloc({ search: { connect } });

      await bloc.init();
      await bloc.init();

      expect(connect).toHaveBeenCalledTimes(1);
    });
  });

  describe('the panel', () => {
    it('is closed until the input is focused and the session opens it', async () => {
      const { bloc, search } = makeBloc();
      await bloc.init();
      search.report({ isOpen: true });
      expect(bloc.isPanelOpen).toBe(false);

      bloc.focus();

      expect(bloc.isFocused).toBe(true);
      expect(bloc.isPanelOpen).toBe(true);
      expect(search.session.setIsOpen).toHaveBeenCalledWith(true);
    });

    it('closes on blur', async () => {
      const { bloc, search } = makeBloc();
      await bloc.init();
      search.report({ isOpen: true });
      bloc.focus();

      bloc.blur();

      expect(bloc.isPanelOpen).toBe(false);
      expect(search.session.setIsOpen).toHaveBeenLastCalledWith(false);
    });

    it('waits before closing, so a click on a result still lands', async () => {
      vi.useFakeTimers();
      const { bloc, search } = makeBloc({ dismissDelayMs: 200 });
      await bloc.init();
      search.report({ isOpen: true });
      bloc.focus();

      bloc.blur();
      // The blur fires before the click that caused it.
      expect(bloc.isPanelOpen).toBe(true);

      vi.advanceTimersByTime(200);
      expect(bloc.isPanelOpen).toBe(false);
    });

    it('does not close after a re-focus inside the delay', async () => {
      vi.useFakeTimers();
      const { bloc, search } = makeBloc({ dismissDelayMs: 200 });
      await bloc.init();
      search.report({ isOpen: true });
      bloc.focus();

      bloc.blur();
      bloc.focus();
      vi.advanceTimersByTime(500);

      expect(bloc.isPanelOpen).toBe(true);
    });

    it('drops its pending timer when the component goes away', async () => {
      vi.useFakeTimers();
      const { bloc } = makeBloc({ dismissDelayMs: 200 });
      await bloc.init();
      bloc.focus();
      bloc.blur();

      bloc.destroy();

      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe('the grouped results', () => {
    it('keeps the two indices apart, in the order the sources are declared', async () => {
      const { bloc, search } = makeBloc();
      await bloc.init();

      search.report({
        query: 'frieren',
        isOpen: true,
        collections: [
          collection('data', [anime('a1'), anime('a2')]),
          collection('works', [work('w1', 'berserk')])
        ]
      });

      // Algolia ranks each index on its own; the two scores are not comparable.
      expect(bloc.groups.map((g) => g.sourceId)).toEqual(['data', 'works']);
      expect(bloc.flatItems).toHaveLength(3);
      expect(bloc.hasResults).toBe(true);
    });

    it('drops a group that matched nothing', async () => {
      const { bloc, search } = makeBloc();
      await bloc.init();

      search.report({
        collections: [collection('data', [anime('a1')]), collection('works', [])]
      });

      expect(bloc.groups.map((g) => g.sourceId)).toEqual(['data']);
    });

    it('drops null items the index sent', async () => {
      const { bloc, search } = makeBloc();
      await bloc.init();

      search.report({ collections: [collection('data', [anime('a1'), null, undefined])] });

      expect(bloc.flatItems).toHaveLength(1);
    });

    it('adds no headings while there is only one group', async () => {
      const { bloc, search } = makeBloc();
      await bloc.init();

      search.report({ collections: [collection('data', [anime('a1'), anime('a2')])] });

      // A query that matches no works looks exactly as it did before works
      // were searchable.
      expect(bloc.rows.every((row) => row.kind === 'item')).toBe(true);
      expect(bloc.rows).toHaveLength(2);
    });

    it('heads each group once there are two', async () => {
      const { bloc, search } = makeBloc();
      await bloc.init();

      search.report({
        collections: [
          collection('data', [anime('a1')]),
          collection('works', [work('w1', 'berserk')])
        ]
      });

      expect(bloc.rows.map((r) => r.kind)).toEqual(['header', 'item', 'header', 'item']);
    });

    it('numbers the rows across the whole panel, not per section', async () => {
      const { bloc, search } = makeBloc();
      await bloc.init();

      search.report({
        collections: [
          collection('data', [anime('a1'), anime('a2')]),
          collection('works', [work('w1', 'berserk')])
        ]
      });

      const items = bloc.rows.filter((r) => r.kind === 'item');
      expect(items.map((r) => (r as { index: number }).index)).toEqual([0, 1, 2]);
    });

    it('names each group in words', () => {
      const { bloc } = makeBloc();

      expect(bloc.groupLabel('data')).toBe('Anime');
      expect(bloc.groupLabel('works')).toBe('Manga & light novels');
      // An unknown source is shown as itself rather than as blank.
      expect(bloc.groupLabel('films')).toBe('films');
    });

    it('tells "nothing matched" apart from "nothing typed"', async () => {
      const { bloc, search } = makeBloc();
      await bloc.init();
      bloc.focus();

      search.report({ query: 'zzzz', isOpen: true, collections: [] });
      expect(bloc.isEmptyResult).toBe(true);

      search.report({ query: '', isOpen: true, collections: [] });
      expect(bloc.isEmptyResult).toBe(false);
    });
  });

  describe('typing', () => {
    it('pushes the query at the session and refreshes', async () => {
      const { bloc, search } = makeBloc();
      await bloc.init();

      bloc.input('frieren');

      expect(search.session.setQuery).toHaveBeenCalledWith('frieren');
      expect(search.session.refresh).toHaveBeenCalledTimes(1);
    });

    it('drops the highlight, so Enter cannot open a stale row', async () => {
      const { bloc, search, navigate } = makeBloc();
      await bloc.init();
      search.report({ query: 'f', isOpen: true, collections: [collection('data', [anime('a1')])] });
      bloc.keydown('ArrowDown');
      expect(bloc.activeIndex).toBe(0);

      bloc.input('fri');

      expect(bloc.activeIndex).toBe(-1);
      navigate.mockClear();
    });

    it('is inert before the session exists', () => {
      const { bloc } = makeBloc();

      expect(() => bloc.input('frieren')).not.toThrow();
    });
  });

  describe('the keyboard', () => {
    async function withResults(count = 3) {
      const made = makeBloc();
      await made.bloc.init();
      made.search.report({
        query: 'f',
        isOpen: true,
        collections: [
          collection(
            'data',
            Array.from({ length: count }, (_, i) => anime(`a${i}`))
          )
        ]
      });
      return made;
    }

    it('moves down and wraps at the end', async () => {
      const { bloc } = await withResults(2);

      expect(bloc.activeIndex).toBe(-1);
      bloc.keydown('ArrowDown');
      expect(bloc.activeIndex).toBe(0);
      bloc.keydown('ArrowDown');
      expect(bloc.activeIndex).toBe(1);
      bloc.keydown('ArrowDown');
      expect(bloc.activeIndex).toBe(0);
    });

    it('moves up from nothing to the last row', async () => {
      const { bloc } = await withResults(3);

      bloc.keydown('ArrowUp');

      expect(bloc.activeIndex).toBe(2);
    });

    it('reports that it took the key, so the view can swallow it', async () => {
      const { bloc } = await withResults();

      expect(bloc.keydown('ArrowDown')).toBe('moved');
      expect(bloc.keydown('Escape')).toBe('dismissed');
      expect(bloc.keydown('Tab')).toBe('ignored');
      expect(bloc.keydown('a')).toBe('ignored');
    });

    it('ignores the arrows while the panel is closed', async () => {
      const { bloc, search } = makeBloc();
      await bloc.init();
      search.report({ isOpen: false, collections: [collection('data', [anime('a1')])] });

      expect(bloc.keydown('ArrowDown')).toBe('ignored');
      expect(bloc.activeIndex).toBe(-1);
    });

    it('has nowhere to move with no results', async () => {
      const { bloc } = await withResults(0);

      bloc.keydown('ArrowDown');

      expect(bloc.activeIndex).toBe(-1);
    });

    it('clamps a highlight left pointing past a shorter list', async () => {
      const { bloc, search } = await withResults(3);
      bloc.keydown('ArrowDown');
      bloc.keydown('ArrowDown');
      bloc.keydown('ArrowDown');
      expect(bloc.activeIndex).toBe(2);

      // Results change under the user as they arrow through them.
      search.report({
        query: 'f',
        isOpen: true,
        collections: [collection('data', [anime('a0')])]
      });

      expect(bloc.activeIndex).toBe(0);
    });

    it('Escape drops the highlight and dismisses', async () => {
      const { bloc } = await withResults();
      bloc.focus();
      bloc.keydown('ArrowDown');

      bloc.keydown('Escape');

      expect(bloc.activeIndex).toBe(-1);
      expect(bloc.isFocused).toBe(false);
    });
  });

  describe('choosing', () => {
    it('Enter opens the highlighted result rather than searching', async () => {
      const { bloc, navigate, analytics, search } = makeBloc();
      await bloc.init();
      search.report({
        query: 'frieren',
        isOpen: true,
        collections: [collection('data', [anime('a1', 'frieren')])]
      });
      bloc.keydown('ArrowDown');

      expect(bloc.keydown('Enter')).toBe('submitted');
      expect(navigate).toHaveBeenCalledWith('/anime/frieren');
      expect(analytics.searchPerformed).not.toHaveBeenCalled();
    });

    it('Enter with nothing highlighted runs the full search', async () => {
      const { bloc, navigate, analytics, search } = makeBloc();
      await bloc.init();
      search.report({
        query: 'frieren',
        isOpen: true,
        collections: [collection('data', [anime('a1'), anime('a2')])]
      });

      expect(bloc.submit()).toBe('submitted');
      expect(analytics.searchPerformed).toHaveBeenCalledWith('frieren', 2);
      expect(navigate).toHaveBeenCalledWith('/search?query=frieren');
    });

    it('Enter on an empty box does nothing', async () => {
      const { bloc, navigate } = makeBloc();
      await bloc.init();

      expect(bloc.submit()).toBe('ignored');
      expect(navigate).not.toHaveBeenCalled();
    });

    it('closes and clears the panel when a result is chosen', async () => {
      const { bloc, search } = makeBloc();
      await bloc.init();
      search.report({ query: 'f', isOpen: true, collections: [collection('data', [anime('a1')])] });
      bloc.focus();

      bloc.select(anime('a1', 'frieren'));

      expect(bloc.isFocused).toBe(false);
      expect(search.session.setQuery).toHaveBeenLastCalledWith('');
      expect(search.session.setIsOpen).toHaveBeenLastCalledWith(false);
    });

    it('goes nowhere for a hit with no route, but still closes', async () => {
      const { bloc, navigate } = makeBloc();
      await bloc.init();
      bloc.focus();

      bloc.select(work('w1', null));

      expect(navigate).not.toHaveBeenCalled();
      expect(bloc.isFocused).toBe(false);
    });

    it('the footer link takes over the navigation', async () => {
      const { bloc, navigate, search } = makeBloc();
      await bloc.init();
      search.report({ query: 'frieren', isOpen: true, collections: [] });

      expect(bloc.searchAllHref).toBe('/search?query=frieren');
      bloc.searchAll();
      expect(navigate).toHaveBeenCalledWith('/search?query=frieren');
    });

    it('the footer link does nothing on an empty box', async () => {
      const { bloc, navigate } = makeBloc();
      await bloc.init();

      bloc.searchAll();

      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('the fallback plain input', () => {
    it('searches for text the bloc does not own', () => {
      const { bloc, navigate, analytics } = makeBloc();

      bloc.searchFor('  frieren  ');

      expect(analytics.searchPerformed).toHaveBeenCalledWith('frieren', 0);
      expect(navigate).toHaveBeenCalledWith('/search?query=frieren');
    });

    it('does nothing for blank text', () => {
      const { bloc, navigate } = makeBloc();

      bloc.searchFor('   ');

      expect(navigate).not.toHaveBeenCalled();
    });
  });
});
