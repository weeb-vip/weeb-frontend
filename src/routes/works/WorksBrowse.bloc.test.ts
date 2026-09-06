import { describe, it, expect } from 'vitest';
import { writable } from 'svelte/store';
import {
  linkableWorks,
  pageWindow,
  shelfLimitFor,
  shelfPageHref,
  WorksBrowseBloc,
  type WorkSummary,
  type WorksBrowseAccessor,
} from './WorksBrowse.bloc.svelte';

/**
 * The shelves behind /manga and /light-novels.
 *
 * Two things here are worth pinning. The pager arithmetic -- `pageWindow` and
 * `shelfPageHref` -- is the one part of the page with an off-by-one to get
 * wrong, and page 1 being the bare path rather than `?page=1` is a rule the
 * canonical URL depends on. And `linkableWorks` is a data rule, not a
 * cosmetic one: `workBySlug` is the only lookup the schema exposes, so a work
 * the scraper has not given a slug yet would render a card leading to a
 * guaranteed 404.
 */

/* ── Harness ─────────────────────────────────────────────────────────────── */

type Payload = ReturnType<WorksBrowseAccessor>;

const BASE: Payload = {
  heading: 'Manga',
  blurb: 'Every comic in the catalogue.',
  basePath: '/manga',
  shelves: null,
  works: [],
  sort: null,
  total: 0,
  page: 1,
  totalPages: 0,
  ssrError: null,
};

/** A work as the loader hands one over. `null` slug means unlinkable. */
function work(slug: string | null, extra: Record<string, any> = {}): WorkSummary {
  return { id: `id-${slug}`, urlSlug: slug, titleEn: `Title ${slug}`, ...extra };
}

function works(count: number, prefix = 'w'): WorkSummary[] {
  return Array.from({ length: count }, (_, i) => work(`${prefix}-${i}`));
}

/**
 * The bloc with a mutable payload behind its source accessor and a viewport
 * port that can be pushed across a breakpoint without resizing anything.
 */
function setup(overrides: Partial<Payload> = {}, viewport = { phone: false, tablet: false }) {
  let payload: Payload = { ...BASE, ...overrides };
  const isPhone = writable(viewport.phone);
  const isTablet = writable(viewport.tablet);

  const bloc = new WorksBrowseBloc({
    source: () => payload,
    viewport: { isPhone, isTablet },
  });

  return {
    bloc,
    isPhone,
    isTablet,
    set: (next: Partial<Payload>) => {
      payload = { ...payload, ...next };
    },
  };
}

/* ── linkableWorks ───────────────────────────────────────────────────────── */

describe('linkableWorks', () => {
  it('keeps only the works that have a slug to open', () => {
    const list = [work('berserk'), work(null), work('vinland-saga')];

    expect(linkableWorks(list).map((w) => w.urlSlug)).toEqual(['berserk', 'vinland-saga']);
  });

  it('treats an empty slug as no slug', () => {
    expect(linkableWorks([work('')])).toEqual([]);
  });

  it('survives a null entry in the list', () => {
    expect(linkableWorks([null as unknown as WorkSummary, work('berserk')])).toHaveLength(1);
  });

  it('answers with an empty list for null and undefined', () => {
    expect(linkableWorks(null)).toEqual([]);
    expect(linkableWorks(undefined)).toEqual([]);
    expect(linkableWorks([])).toEqual([]);
  });

  it('does not mutate the list it was handed', () => {
    const list = [work('berserk'), work(null)];

    linkableWorks(list);

    expect(list).toHaveLength(2);
  });
});

/* ── shelfLimitFor ───────────────────────────────────────────────────────── */

describe('shelfLimitFor', () => {
  it('holds six cards on a phone', () => {
    expect(shelfLimitFor(true, false)).toBe(6);
  });

  it('holds twelve on a tablet, where a shelf costs more rows than it looks', () => {
    expect(shelfLimitFor(false, true)).toBe(12);
  });

  it('holds twenty on the desktop layout', () => {
    expect(shelfLimitFor(false, false)).toBe(20);
  });

  it('lets phone win when both breakpoints somehow answer true', () => {
    expect(shelfLimitFor(true, true)).toBe(6);
  });
});

/* ── shelfPageHref ───────────────────────────────────────────────────────── */

describe('shelfPageHref', () => {
  it('is the bare path for page one, so the canonical URL has no page parameter', () => {
    expect(shelfPageHref('/manga', null, 1)).toBe('/manga');
  });

  it('keeps the sort but drops the page on page one', () => {
    expect(shelfPageHref('/manga', 'POPULARITY', 1)).toBe('/manga?sort=POPULARITY');
  });

  it('writes both once past the first page', () => {
    expect(shelfPageHref('/manga', 'SCORE', 4)).toBe('/manga?sort=SCORE&page=4');
  });

  it('writes a page with no sort', () => {
    expect(shelfPageHref('/light-novels', null, 3)).toBe('/light-novels?page=3');
  });

  it('treats page zero the same as page one rather than writing ?page=0', () => {
    expect(shelfPageHref('/manga', null, 0)).toBe('/manga');
  });
});

/* ── pageWindow ──────────────────────────────────────────────────────────── */

describe('pageWindow', () => {
  it('is empty when there is nothing to page through', () => {
    expect(pageWindow(1, 0)).toEqual([]);
    expect(pageWindow(1, 1)).toEqual([]);
  });

  it('keeps the first and last page reachable from the middle', () => {
    // 2,219 links is not a pager; the ends still have to be one click away.
    expect(pageWindow(50, 2219)).toEqual([1, 48, 49, 50, 51, 52, 2219]);
  });

  it('does not run off the front of the range', () => {
    expect(pageWindow(1, 10)).toEqual([1, 2, 3, 10]);
  });

  it('does not run off the end of the range', () => {
    expect(pageWindow(10, 10)).toEqual([1, 8, 9, 10]);
  });

  it('collapses to a plain run when the whole range fits in the window', () => {
    expect(pageWindow(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('never repeats the first or last page when the window reaches them', () => {
    expect(pageWindow(2, 6)).toEqual([1, 2, 3, 4, 6]);
  });

  it('honours a narrower span', () => {
    expect(pageWindow(5, 10, 0)).toEqual([1, 5, 10]);
    expect(pageWindow(5, 10, 1)).toEqual([1, 4, 5, 6, 10]);
  });

  it('still offers the ends for a page outside the range', () => {
    expect(pageWindow(0, 5)).toEqual([1, 2, 5]);
    expect(pageWindow(99, 5)).toEqual([1, 5]);
  });
});

/* ── mode ────────────────────────────────────────────────────────────────── */

describe('mode', () => {
  it('is error whenever the loader reported one', () => {
    const { bloc } = setup({ ssrError: 'the works service timed out' });

    expect(bloc.mode).toBe('error');
    expect(bloc.ssrError).toBe('the works service timed out');
  });

  it('lets the error win over a payload that would otherwise render', () => {
    const { bloc } = setup({
      ssrError: 'boom',
      sort: 'POPULARITY',
      shelves: [{ sort: 'POPULARITY', label: 'Most popular', works: works(3) }],
    });

    expect(bloc.mode).toBe('error');
  });

  it('is paged when a sort is pinned', () => {
    const { bloc } = setup({ sort: 'SCORE', works: works(3) });

    expect(bloc.mode).toBe('paged');
  });

  it('is shelves when there are shelves and no pinned sort', () => {
    const { bloc } = setup({ shelves: [] });

    expect(bloc.mode).toBe('shelves');
  });

  it('is none when the loader gave neither', () => {
    const { bloc } = setup();

    expect(bloc.mode).toBe('none');
  });

  it('re-reads the payload rather than caching the first answer', () => {
    const harness = setup();
    expect(harness.bloc.mode).toBe('none');

    harness.set({ sort: 'NEWEST' });

    expect(harness.bloc.mode).toBe('paged');
  });
});

/* ── headMeta ────────────────────────────────────────────────────────────── */

describe('headMeta', () => {
  it('says nothing when there is nothing to count', () => {
    const { bloc } = setup({ total: 0 });

    expect(bloc.headMeta).toBe('');
  });

  it('says nothing rather than "-3 titles" for a nonsense total', () => {
    const { bloc } = setup({ total: -3 });

    expect(bloc.headMeta).toBe('');
  });

  it('is just the count in shelf mode', () => {
    const { bloc } = setup({ total: 53210 });

    expect(bloc.headMeta).toBe('53,210 titles');
  });

  it('adds the shelf name and where in it you are, in paged mode', () => {
    const { bloc } = setup({ total: 53210, sort: 'SCORE', page: 7, totalPages: 2219 });

    expect(bloc.headMeta).toBe('53,210 titles · Highest rated, page 7 of 2,219');
  });

  it('falls back to the default shelf label for a sort it does not know', () => {
    const { bloc } = setup({ total: 10, sort: 'TITLE', page: 1, totalPages: 1 });

    expect(bloc.headMeta).toBe('10 titles · Most popular, page 1 of 1');
  });
});

describe('shelfTitle', () => {
  it('is empty in shelf mode, where no single shelf is open', () => {
    const { bloc } = setup({ shelves: [] });

    expect(bloc.shelfTitle).toBe('');
  });

  it('names the open shelf in paged mode', () => {
    const { bloc } = setup({ sort: 'NEWEST' });

    expect(bloc.shelfTitle).toBe('Newest');
  });
});

/* ── shelves ─────────────────────────────────────────────────────────────── */

describe('shelves', () => {
  it('drops a shelf that came back empty rather than rendering a bare heading', () => {
    const { bloc } = setup({
      shelves: [
        { sort: 'POPULARITY', label: 'Most popular', works: works(2, 'a') },
        { sort: 'SCORE', label: 'Highest rated', works: [] },
        { sort: 'NEWEST', label: 'Newest', works: works(1, 'c') },
      ],
    });

    expect(bloc.shelves.map((s) => s.sort)).toEqual(['POPULARITY', 'NEWEST']);
  });

  it('drops a shelf whose every work is unlinkable', () => {
    const { bloc } = setup({
      shelves: [{ sort: 'SCORE', label: 'Highest rated', works: [work(null), work('')] }],
    });

    expect(bloc.shelves).toEqual([]);
  });

  it('trims each shelf to the breakpoint limit', () => {
    const { bloc } = setup(
      { shelves: [{ sort: 'POPULARITY', label: 'Most popular', works: works(40) }] },
      { phone: false, tablet: true },
    );

    expect(bloc.shelves[0].works).toHaveLength(12);
  });

  it('drops the unlinkable works before it counts to the limit', () => {
    // Filtering after the slice would leave a short shelf on a page of them.
    const list = [work(null), ...works(10, 'ok')];
    const { bloc } = setup(
      { shelves: [{ sort: 'POPULARITY', label: 'Most popular', works: list }] },
      { phone: true, tablet: false },
    );

    expect(bloc.shelves[0].works).toHaveLength(6);
    expect(bloc.shelves[0].works.every((w) => !!w.urlSlug)).toBe(true);
  });

  it('keeps the shelf label and sort it was given', () => {
    const { bloc } = setup({
      shelves: [{ sort: 'NEWEST', label: 'Newest', works: works(1) }],
    });

    expect(bloc.shelves[0]).toMatchObject({ sort: 'NEWEST', label: 'Newest' });
  });

  it('is empty in paged mode, where the loader sent no shelves', () => {
    const { bloc } = setup({ sort: 'SCORE', works: works(3) });

    expect(bloc.shelves).toEqual([]);
  });
});

describe('shelvesAreEmpty', () => {
  it('is true when every shelf came back with nothing -- a real answer', () => {
    const { bloc } = setup({
      shelves: [
        { sort: 'POPULARITY', label: 'Most popular', works: [] },
        { sort: 'SCORE', label: 'Highest rated', works: [work(null)] },
      ],
    });

    expect(bloc.shelvesAreEmpty).toBe(true);
  });

  it('is true for a payload with no shelves at all in it', () => {
    const { bloc } = setup({ shelves: [] });

    expect(bloc.shelvesAreEmpty).toBe(true);
  });

  it('is false the moment one shelf has something on it', () => {
    const { bloc } = setup({
      shelves: [
        { sort: 'POPULARITY', label: 'Most popular', works: [] },
        { sort: 'SCORE', label: 'Highest rated', works: works(1) },
      ],
    });

    expect(bloc.shelvesAreEmpty).toBe(false);
  });

  it('is false in paged mode, where there are no shelves to be empty', () => {
    const { bloc } = setup({ sort: 'SCORE' });

    expect(bloc.shelvesAreEmpty).toBe(false);
  });

  it('ignores the breakpoint limit: a trimmed shelf is not an empty one', () => {
    const { bloc } = setup(
      { shelves: [{ sort: 'POPULARITY', label: 'Most popular', works: works(40) }] },
      { phone: true, tablet: false },
    );

    expect(bloc.shelvesAreEmpty).toBe(false);
  });
});

/* ── The viewport port ───────────────────────────────────────────────────── */

describe('shelfLimit', () => {
  it('reads the desktop limit when neither breakpoint matches', () => {
    const { bloc } = setup();

    expect(bloc.shelfLimit).toBe(20);
  });

  it('follows the viewport across a breakpoint', () => {
    const { bloc, isPhone, isTablet } = setup();
    expect(bloc.shelfLimit).toBe(20);

    isTablet.set(true);
    expect(bloc.shelfLimit).toBe(12);

    isTablet.set(false);
    isPhone.set(true);
    expect(bloc.shelfLimit).toBe(6);
  });

  it('reshapes the shelves when the viewport changes under them', () => {
    const { bloc, isPhone } = setup({
      shelves: [{ sort: 'POPULARITY', label: 'Most popular', works: works(40) }],
    });
    expect(bloc.shelves[0].works).toHaveLength(20);

    isPhone.set(true);

    expect(bloc.shelves[0].works).toHaveLength(6);
  });
});

/* ── Paged mode ──────────────────────────────────────────────────────────── */

describe('pageWorks', () => {
  it('leaves out the works that have no page to open', () => {
    const { bloc } = setup({
      sort: 'SCORE',
      works: [work('berserk'), work(null), work('vinland-saga')],
    });

    expect(bloc.pageWorks.map((w) => w.urlSlug)).toEqual(['berserk', 'vinland-saga']);
  });

  it('is empty when the page carried nothing', () => {
    const { bloc } = setup({ sort: 'SCORE', works: [] });

    expect(bloc.pageWorks).toEqual([]);
  });

  it('is not trimmed to the shelf limit -- a page is a full page', () => {
    const { bloc } = setup({ sort: 'SCORE', works: works(40) }, { phone: true, tablet: false });

    expect(bloc.pageWorks).toHaveLength(40);
  });
});

describe('the pager', () => {
  it('offers a window of pages around the one being read', () => {
    const { bloc } = setup({ sort: 'SCORE', page: 50, totalPages: 2219 });

    expect(bloc.pageWindow).toEqual([1, 48, 49, 50, 51, 52, 2219]);
  });

  it('offers nothing when the whole shelf is one page', () => {
    const { bloc } = setup({ sort: 'SCORE', page: 1, totalPages: 1 });

    expect(bloc.pageWindow).toEqual([]);
  });

  it('builds each link off the base path and the open shelf', () => {
    const { bloc } = setup({ basePath: '/light-novels', sort: 'NEWEST', page: 3, totalPages: 9 });

    expect(bloc.hrefForPage(1)).toBe('/light-novels?sort=NEWEST');
    expect(bloc.hrefForPage(4)).toBe('/light-novels?sort=NEWEST&page=4');
  });
});

/* ── Row helpers ─────────────────────────────────────────────────────────── */

describe('row helpers', () => {
  it('links every work under /manga, whichever browse page it came from', () => {
    // Light novels are works too, and /manga/<slug> is the only work route.
    const { bloc } = setup({ basePath: '/light-novels' });

    expect(bloc.hrefForWork(work('spice-and-wolf'))).toBe('/manga/spice-and-wolf');
  });

  it('describes a work by kind and first publication year', () => {
    const { bloc } = setup();

    expect(bloc.subtitleFor(work('x', { type: 'LIGHT_NOVEL', publishedFrom: '2006-02-10' }))).toBe(
      'Light novel · 2006',
    );
  });

  it('still says something for a work with no kind or date', () => {
    const { bloc } = setup();

    expect(bloc.subtitleFor(work('x'))).toBe('Work');
  });
});

/* ── The plain reads and the defaults ────────────────────────────────────── */

describe('the loader payload passthrough', () => {
  it('surfaces the heading, blurb, base path and pager numbers verbatim', () => {
    const { bloc } = setup({
      heading: 'Light novels',
      blurb: 'Novels, web novels and light novels.',
      basePath: '/light-novels',
      sort: 'NEWEST',
      total: 4321,
      page: 2,
      totalPages: 181,
    });

    expect(bloc.heading).toBe('Light novels');
    expect(bloc.blurb).toBe('Novels, web novels and light novels.');
    expect(bloc.basePath).toBe('/light-novels');
    expect(bloc.sort).toBe('NEWEST');
    expect(bloc.total).toBe(4321);
    expect(bloc.page).toBe(2);
    expect(bloc.totalPages).toBe(181);
    expect(bloc.ssrError).toBeNull();
  });

  it('renders a harmless empty page when constructed with no dependencies at all', () => {
    // The default source is what a mount before the loader lands would read.
    const bloc = new WorksBrowseBloc();

    expect(bloc.mode).toBe('none');
    expect(bloc.heading).toBe('');
    expect(bloc.headMeta).toBe('');
    expect(bloc.shelves).toEqual([]);
    expect(bloc.pageWorks).toEqual([]);
    expect(bloc.pageWindow).toEqual([]);
    expect(bloc.shelvesAreEmpty).toBe(false);
  });
});
