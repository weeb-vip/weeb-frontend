import { getYearUTC, animeHref } from '../../services/utils';

export type RoleFilter = 'all' | 'main' | 'supporting';

/**
 * One entry in the filter strip. Structurally a `TabItem`, declared here rather
 * than imported from the component so the bloc stays free of view imports.
 */
export interface RoleFilterOption {
  value: RoleFilter;
  label: string;
  count: number;
}

/** One credit: a character, and the anime it belongs to when that still exists. */
export interface RoleEntry {
  character: { id?: string | null; name?: string | null; role?: string | null };
  anime?: { id?: string | null; slug?: string | null; titleEn?: string | null; titleJp?: string | null; startDate?: string | null } | null;
  [key: string]: any;
}

export interface Staff {
  id?: string | null;
  givenName?: string | null;
  familyName?: string | null;
  language?: string | null;
  birthday?: string | null;
  birthPlace?: string | null;
  bloodType?: string | null;
  hobbies?: string | null;
  summary?: string | null;
  roles?: RoleEntry[] | null;
  [key: string]: any;
}

/** What the view knows: the loader's staff record, and whether it failed. */
export type StaffAccessor = () => {
  staff: Staff | null;
  ssrError: string | null;
};

export interface VoiceActorPageDeps {
  source?: StaffAccessor;
  /**
   * How many roles a reveal adds. Injectable so a story can show the "show
   * more" affordance without inventing twenty-five fixtures.
   */
  pageSize?: number;
}

/**
 * MyAnimeList writes the role as free text, so this matches on the words that
 * actually appear rather than an enum: "Main", "Main Character", "Protagonist".
 */
export function isMainRole(role: string | null | undefined): boolean {
  const value = (role || '').toLowerCase();
  return value.includes('main') || value.includes('protagonist');
}

/**
 * Roles are revealed a page at a time rather than all at once.
 *
 * Every card loads a character portrait from the CDN, and a prolific voice
 * actor has enough credits to put that well past the browser's six connections
 * per host: rendering all 117 of Mary Elizabeth McGlynn's roles left 234 images
 * still pending after eight seconds, because SafeImage preloads in JS and its
 * per-attempt timeouts pile up behind the queue. A page of 24 keeps the first
 * screen instant, and the rest arrive as they are scrolled to.
 */
export const ROLE_PAGE_SIZE = 24;

/**
 * A voice actor's page: their credits, which slice of them is on screen, and
 * the filter narrowing them.
 *
 * The bloc exists for the state that outlives a render -- the filter and the
 * reveal count, which have to reset together -- and to keep the derived counts
 * out of a chain of `$:` blocks that only made sense read top to bottom.
 */
export class VoiceActorPageBloc {
  // Initialised at declaration, not only in the constructor: the `$derived`
  // fields below are declared after it and TypeScript reads that as a use
  // before initialisation, even though a derived is lazy.
  readonly #source: StaffAccessor = () => ({ staff: null, ssrError: null });
  readonly #pageSize: number;

  #filter = $state<RoleFilter>('all');
  #visibleCount = $state(ROLE_PAGE_SIZE);

  constructor({
    source = () => ({ staff: null, ssrError: null }),
    pageSize = ROLE_PAGE_SIZE,
  }: VoiceActorPageDeps = {}) {
    this.#source = source;
    this.#pageSize = pageSize;
    this.#visibleCount = pageSize;
  }

  get ssrError(): string | null {
    return this.#source().ssrError;
  }

  get staff(): Staff | null {
    return this.#source().staff;
  }

  get name(): string {
    const staff = this.staff;
    return `${staff?.givenName ?? ''} ${staff?.familyName ?? ''}`.trim();
  }

  get summary(): string | null {
    return this.staff?.summary || null;
  }

  readonly #roles: RoleEntry[] = $derived(this.#source().staff?.roles ?? []);

  get roles(): RoleEntry[] {
    return this.#roles;
  }

  /**
   * Counted over roles, not anime. A voice actor can hold two credits in one
   * title -- a lead and a one-scene bit part -- and collapsing those to "1
   * anime" would understate the work. The anime count is reported separately.
   */
  get mainCount(): number {
    return this.#roles.filter((role) => isMainRole(role.character?.role)).length;
  }

  get supportingCount(): number {
    return this.#roles.length - this.mainCount;
  }

  get animeCount(): number {
    return new Set(this.#roles.filter((r) => r.anime).map((r) => r.anime!.id)).size;
  }

  /** The filter strip. A bucket with nothing in it is not offered. */
  get filterOptions(): RoleFilterOption[] {
    const options: RoleFilterOption[] = [
      { value: 'all', label: 'All', count: this.#roles.length },
      { value: 'main', label: 'Main', count: this.mainCount },
      { value: 'supporting', label: 'Supporting', count: this.supportingCount },
    ];
    return options.filter((option) => option.count > 0);
  }

  /** Only worth drawing when there is a choice to make. */
  get showFilters(): boolean {
    return this.filterOptions.length > 1;
  }

  get filter(): RoleFilter {
    return this.#filter;
  }

  /**
   * Already ordered newest-first by the API, so filtering preserves that and
   * there is nothing to re-sort here.
   */
  readonly #filteredRoles: RoleEntry[] = $derived(
    this.#roles.filter((role) => {
      if (this.#filter === 'all') return true;
      const main = isMainRole(role.character?.role);
      return this.#filter === 'main' ? main : !main;
    }),
  );

  get visibleRoles(): RoleEntry[] {
    return this.#filteredRoles.slice(0, this.#visibleCount);
  }

  get remaining(): number {
    return this.#filteredRoles.length - this.visibleRoles.length;
  }

  /** How many the next reveal adds, for the button's own label. */
  get nextRevealSize(): number {
    return Math.min(this.remaining, this.#pageSize);
  }

  /**
   * The scraped profile fields are usually empty strings rather than nulls, so
   * every one of these needs a truthiness check or the page renders a column of
   * labels with nothing beside them.
   */
  get details(): { label: string; value: string }[] {
    const staff = this.staff;
    return [
      { label: 'Language', value: staff?.language },
      { label: 'Born', value: staff?.birthday },
      { label: 'Birthplace', value: staff?.birthPlace },
      { label: 'Blood type', value: staff?.bloodType },
      { label: 'Hobbies', value: staff?.hobbies },
    ].filter((detail): detail is { label: string; value: string } => !!detail.value);
  }

  /**
   * Reset the reveal with the filter, or switching would keep an expansion the
   * reader never asked for on the new, shorter list.
   */
  selectFilter(filter: string): void {
    this.#filter = filter as RoleFilter;
    this.#visibleCount = this.#pageSize;
  }

  showMore(): void {
    this.#visibleCount += this.#pageSize;
  }

  isMain(role: string | null | undefined): boolean {
    return isMainRole(role);
  }

  /**
   * Falls back to the id for anime the slug backfill has not reached; the
   * /anime route resolves both.
   */
  hrefFor(anime: { id?: string | null; slug?: string | null }): string {
    return animeHref(anime);
  }

  yearFor(anime: { startDate?: string | null }): string {
    return getYearUTC(anime?.startDate);
  }
}
