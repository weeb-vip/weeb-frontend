import { fromStore, type Readable } from 'svelte/store';
import { preferencesStore, getAnimeTitle, type TitleLanguage } from '../stores/preferences';
import { getSafeImageUrl } from '../utils/image';
import { readableWorkType, workYear } from '../../utils/workDisplay';

/** A source work as this page reads one. Loose: the record is rendered verbatim. */
export type Work = {
  id?: string | null;
  titleEn?: string | null;
  titleJp?: string | null;
  imageUrl?: string | null;
  type?: string | null;
  status?: string | null;
  publishedFrom?: string | null;
  publishedTo?: string | null;
  authors?: string[] | null;
  serialization?: string | null;
  demographic?: string | null;
  volumes?: number | null;
  chapters?: number | null;
  score?: number | null;
  ranking?: number | null;
  synopsis?: string | null;
  adaptations?: any[] | null;
  userWork?: any;
  [key: string]: any;
};

/** One label/value pair in the stats strip. */
export interface WorkFact {
  label: string;
  value: string;
}

/** One row of the credits list. */
export interface WorkCredit {
  label: string;
  value: string;
}

/** The slice of the preferences store the adaptation cards read. */
export interface TitleLanguagePort extends Readable<{ titleLanguage: TitleLanguage }> {}

/** Where a CDN image URL comes from. Stubbed in stories so no network is touched. */
export type ImageUrlPort = (id: string, path?: string) => string;

/** What the view knows: the loader's work, and whether the load failed. */
export type WorkAccessor = () => {
  work: Work | null;
  ssrError: string | null;
};

export interface MangaContentDeps {
  source?: WorkAccessor;
  preferences?: TitleLanguagePort;
  imageUrl?: ImageUrlPort;
}

/**
 * "1997 – 2008", "1997 – ongoing", or "1997". Runs to a year rather than a
 * date: a publication that spans a decade is not made clearer by its day.
 */
export function publishedRange(
  from: string | null | undefined,
  to: string | null | undefined,
  status: string | null | undefined,
): string | null {
  const start = workYear(from);
  if (!start) return null;
  const end = workYear(to);
  if (end && end !== start) return `${start} – ${end}`;
  if (end) return start;
  // No end date and still running reads as ongoing; no end date on a finished
  // work means we simply do not know, and inventing a dash implies we do.
  return status && status.toLowerCase().includes('publish') ? `${start} – ongoing` : start;
}

/**
 * Thousands separators on counts. The design system sets every number the
 * product is accountable for in mono; grouping is what makes six figures
 * scannable at that size.
 */
function grouped(value: number | null | undefined): string | null {
  return value === null || value === undefined ? null : value.toLocaleString('en-US');
}

/**
 * The stats strip.
 *
 * Volumes and chapters are facts about the work. Score and ranked are shown
 * because the anime pages already show both and a reader arriving from one
 * expects the same measure.
 *
 * Members and favourites are deliberately absent. They are MyAnimeList's
 * community counts, and rendered here unlabelled they read as weeb.vip's own --
 * we have no such number. They are also the one thing this product says it does
 * not do: the neighbouring sites compete on community, and this one does not
 * follow them there.
 */
export function factsFor(work: Work | null): WorkFact[] {
  if (!work) return [];
  return [
    { label: 'Volumes', value: grouped(work.volumes) },
    { label: 'Chapters', value: grouped(work.chapters) },
    { label: 'Score', value: work.score != null ? Number(work.score).toFixed(2) : null },
    { label: 'Ranked', value: work.ranking != null ? `#${grouped(work.ranking)}` : null },
  ].filter((fact): fact is WorkFact => fact.value !== null && fact.value !== undefined);
}

/**
 * The source-work page: /manga/<slug>.
 *
 * The bloc owns what the page is made of -- the cover and banner candidates,
 * the credits, the stats strip, the adaptations -- plus the one piece of real
 * state: which hero image actually won, which decides the treatment.
 */
export class MangaContentBloc {
  readonly #source: WorkAccessor;
  readonly #prefs: { current: { titleLanguage: TitleLanguage } };
  readonly #imageUrl: ImageUrlPort;

  /**
   * Which source actually won decides the treatment, rather than which one was
   * offered: a missing banner falls through to the poster and then the cover,
   * and a portrait shown at banner treatment looks like a mistake.
   */
  #heroIsBanner = $state(false);

  constructor({
    source = () => ({ work: null, ssrError: null }),
    preferences = preferencesStore,
    imageUrl = getSafeImageUrl,
  }: MangaContentDeps = {}) {
    this.#source = source;
    this.#prefs = fromStore(preferences);
    this.#imageUrl = imageUrl;
  }

  get work(): Work | null {
    return this.#source().work;
  }

  get ssrError(): string | null {
    return this.#source().ssrError;
  }

  get hasWork(): boolean {
    return !this.ssrError && !!this.work;
  }

  get title(): string {
    const work = this.work;
    return work?.titleEn || work?.titleJp || 'Untitled';
  }

  /** Only worth a second line when it says something the first one did not. */
  get japaneseTitle(): string | null {
    const work = this.work;
    return work?.titleJp && work.titleJp !== work?.titleEn ? work.titleJp : null;
  }

  get readableType(): string {
    return readableWorkType(this.work?.type);
  }

  /**
   * The cover, from our CDN under /works/<id> -- the same path anime posters
   * take. imageUrl on the record is MyAnimeList's own host and is kept only as
   * the last fallback, for a work whose cover image-sync has not fetched yet.
   */
  readonly #coverSources: string[] = $derived.by(() => {
    const work = this.work;
    if (!work?.id) return [];
    return [this.#imageUrl(work.id, 'works'), work.imageUrl].filter(Boolean) as string[];
  });

  get coverSources(): string[] {
    return this.#coverSources;
  }

  /**
   * The banner behind the hero.
   *
   * A work's own art is a 2:3 cover, and a portrait doing a wide banner's job
   * has to be scaled past the frame and blurred to avoid hard edges -- which is
   * a fallback, not a design. An adaptation has real wide key art, synced from
   * TheTVDB under banners/<anime id>, so when one exists the page uses it and
   * shows artwork rather than a smear of colour.
   *
   * The oldest adaptation, which is what the query returns first. A work with
   * several is being adapted repeatedly, and the first one is the one its
   * audience recognises.
   */
  get heroSources(): string[] {
    const banner = this.adaptations[0];
    if (!banner?.id) return this.#coverSources;
    return [
      this.#imageUrl(banner.id, 'banners'),
      this.#imageUrl(banner.id),
      ...this.#coverSources,
    ];
  }

  get heroIsBanner(): boolean {
    return this.#heroIsBanner;
  }

  /** SafeImage reports which candidate it settled on; the treatment follows it. */
  heroChosen(detail: { src: string | null; reason: string }): void {
    this.#heroIsBanner = typeof detail?.src === 'string' && detail.src.includes('/banners/');
  }

  get publishedRange(): string | null {
    const work = this.work;
    return publishedRange(work?.publishedFrom, work?.publishedTo, work?.status);
  }

  /** Type · years · status, already joined -- the markup only prints it. */
  get metaLine(): { label: string; mono: boolean }[] {
    const parts: { label: string; mono: boolean }[] = [{ label: this.readableType, mono: false }];
    const range = this.publishedRange;
    if (range) parts.push({ label: range, mono: true });
    if (this.work?.status) parts.push({ label: this.work.status, mono: false });
    return parts;
  }

  /**
   * Three plain nouns. "Ran in" and "Serialised in" both describe the
   * relationship instead of naming the thing, and neither tells a reader that
   * Afternoon is a magazine -- which is the only fact they were missing. A
   * label that needs explaining is the wrong label.
   */
  get credits(): WorkCredit[] {
    const work = this.work;
    const authors = (work?.authors ?? []) as string[];
    const out: WorkCredit[] = [];
    if (authors.length > 0) {
      out.push({ label: authors.length > 1 ? 'Authors' : 'Author', value: authors.join(', ') });
    }
    if (work?.serialization) out.push({ label: 'Magazine', value: work.serialization });
    if (work?.demographic) out.push({ label: 'Audience', value: work.demographic });
    return out;
  }

  get facts(): WorkFact[] {
    return factsFor(this.work);
  }

  get synopsis(): string | null {
    return this.work?.synopsis || null;
  }

  get adaptations(): any[] {
    return this.work?.adaptations ?? [];
  }

  /** The title as this reader wants to see it -- English or Japanese. */
  adaptationTitle(anime: any): string {
    return getAnimeTitle(anime, this.#prefs.current.titleLanguage);
  }

  /** Year only. A card has no room for a date, and the year is what places it. */
  adaptationSubtitle(anime: any): string {
    return workYear(anime?.startDate) ?? '';
  }

  /**
   * The line shown when nothing was adapted. Not a gap: MyAnimeList holds far
   * more manga than there are anime made from one, so most works genuinely have
   * no adaptation and the page should say so plainly.
   */
  get noAdaptationsMessage(): string {
    return `No anime has been made from this ${this.readableType.toLowerCase()} — or none that we know of yet.`;
  }
}
