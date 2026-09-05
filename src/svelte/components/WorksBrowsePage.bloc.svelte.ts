import { fromStore, type Readable } from 'svelte/store';
import { isPhone, isTablet } from '../stores/viewport';
import { workSubtitle } from '../../utils/workDisplay';
import { shelfLabel } from '../../services/api/graphql/works';

/** A work as the shelves read one. Loose: the cards render the record verbatim. */
export type WorkSummary = {
  id?: string | null;
  urlSlug?: string | null;
  titleEn?: string | null;
  titleJp?: string | null;
  type?: string | null;
  publishedFrom?: string | null;
  score?: number | null;
  [key: string]: any;
};

export interface WorkShelf {
  sort: string;
  label: string;
  works: WorkSummary[];
}

/**
 * The two viewport questions the shelves ask. A port rather than the store
 * singletons so a story can pin a breakpoint instead of resizing the canvas.
 */
export interface ViewportPort {
  isPhone: Readable<boolean>;
  isTablet: Readable<boolean>;
}

/** What the view knows: the loader's payload and which shelf was opened. */
export type WorksBrowseAccessor = () => {
  heading: string;
  blurb: string;
  basePath: string;
  /** Shelf mode: one entry per sort. Null in paged mode. */
  shelves: WorkShelf[] | null;
  /** Paged mode. */
  works: WorkSummary[];
  sort: string | null;
  total: number;
  page: number;
  totalPages: number;
  ssrError: string | null;
};

export interface WorksBrowsePageDeps {
  source?: WorksBrowseAccessor;
  viewport?: ViewportPort;
}

/**
 * A work with no slug has no page to link to -- workBySlug is the only lookup
 * the schema exposes, so a card for one is a guaranteed 404. The scraper is
 * still filling these in, so this is live rather than theoretical.
 */
export function linkableWorks(list: WorkSummary[] | null | undefined): WorkSummary[] {
  return (list ?? []).filter((work) => !!work?.urlSlug);
}

/**
 * How many cards a shelf holds. Matches the homepage exactly, so a shelf is
 * the same size wherever it appears.
 */
export function shelfLimitFor(phone: boolean, tablet: boolean): number {
  return phone ? 6 : tablet ? 12 : 20;
}

/** The href for a page of one shelf. Page 1 is the bare path, not `?page=1`. */
export function shelfPageHref(basePath: string, sort: string | null, page: number): string {
  const params = new URLSearchParams();
  if (sort) params.set('sort', sort);
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/**
 * A window around the current page rather than 2,219 links. First and last stay
 * reachable so the ends of the shelf are one click away.
 */
export function pageWindow(page: number, totalPages: number, span = 2): number[] {
  if (totalPages <= 1) return [];
  const pages = new Set<number>([1, totalPages]);
  for (let p = page - span; p <= page + span; p++) {
    if (p >= 1 && p <= totalPages) pages.add(p);
  }
  return [...pages].sort((a, b) => a - b);
}

/**
 * The shelves behind /manga and /light-novels.
 *
 * The bloc exists for the viewport store -- how many cards a shelf holds is a
 * breakpoint question -- and to hold the pager arithmetic, which is the one
 * part of this page with an off-by-one to get wrong.
 */
export class WorksBrowsePageBloc {
  readonly #source: WorksBrowseAccessor;
  readonly #phone: { current: boolean };
  readonly #tablet: { current: boolean };

  constructor({
    source = () => ({
      heading: '',
      blurb: '',
      basePath: '/',
      shelves: null,
      works: [],
      sort: null,
      total: 0,
      page: 1,
      totalPages: 0,
      ssrError: null,
    }),
    viewport = { isPhone, isTablet },
  }: WorksBrowsePageDeps = {}) {
    this.#source = source;
    this.#phone = fromStore(viewport.isPhone);
    this.#tablet = fromStore(viewport.isTablet);
  }

  get heading(): string {
    return this.#source().heading;
  }

  get blurb(): string {
    return this.#source().blurb;
  }

  get basePath(): string {
    return this.#source().basePath;
  }

  get sort(): string | null {
    return this.#source().sort;
  }

  get total(): number {
    return this.#source().total;
  }

  get page(): number {
    return this.#source().page;
  }

  get totalPages(): number {
    return this.#source().totalPages;
  }

  get ssrError(): string | null {
    return this.#source().ssrError;
  }

  /** Paged mode when a sort is pinned; shelf mode otherwise. */
  get mode(): 'error' | 'paged' | 'shelves' | 'none' {
    const { ssrError, sort, shelves } = this.#source();
    if (ssrError) return 'error';
    if (sort) return 'paged';
    return shelves ? 'shelves' : 'none';
  }

  /** The name of the shelf currently open, for the header and the section title. */
  get shelfTitle(): string {
    const sort = this.sort;
    return sort ? shelfLabel(sort) : '';
  }

  /** The meta line under the heading: how much there is, and where you are in it. */
  get headMeta(): string {
    const { total, sort, page, totalPages } = this.#source();
    if (total <= 0) return '';
    const titles = `${total.toLocaleString()} titles`;
    if (!sort) return titles;
    return `${titles} · ${shelfLabel(sort)}, page ${page} of ${totalPages.toLocaleString()}`;
  }

  /** Paged mode: the works on this page that can actually be opened. */
  get pageWorks(): WorkSummary[] {
    return linkableWorks(this.#source().works);
  }

  get shelfLimit(): number {
    return shelfLimitFor(this.#phone.current, this.#tablet.current);
  }

  /** Shelf mode: only the shelves with something on them, trimmed to the limit. */
  get shelves(): WorkShelf[] {
    return (this.#source().shelves ?? [])
      .map((shelf) => ({ ...shelf, works: linkableWorks(shelf.works).slice(0, this.shelfLimit) }))
      .filter((shelf) => shelf.works.length > 0);
  }

  /** Every shelf came back empty -- a real answer, not a failure. */
  get shelvesAreEmpty(): boolean {
    const shelves = this.#source().shelves;
    return !!shelves && shelves.every((shelf) => linkableWorks(shelf.works).length === 0);
  }

  get pageWindow(): number[] {
    return pageWindow(this.page, this.totalPages);
  }

  hrefForPage(page: number): string {
    return shelfPageHref(this.basePath, this.sort, page);
  }

  hrefForWork(work: WorkSummary): string {
    return `/manga/${work.urlSlug}`;
  }

  subtitleFor(work: WorkSummary): string {
    return workSubtitle(work.type, work.publishedFrom);
  }
}
