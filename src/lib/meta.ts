/**
 * Meta description shaping.
 *
 * The show page used to build its description with `description.substring(0, 160) + '...'`,
 * which produced three separate problems in the served HTML:
 *
 *   - cuts mid-word, so snippets ended "...he makes the noble sacrifi..."
 *   - keeps the source's newlines, and MyAnimeList synopses are multi-paragraph, so
 *     raw line breaks ended up inside the meta tag
 *   - appends "..." even when the text was already complete
 */

/** MyAnimeList boilerplate, useless in a search snippet. */
const ATTRIBUTION = /\s*\[(?:written|source)[^\]]*\]\s*$/i;

/** Trailing punctuation that reads badly immediately before an ellipsis. */
const DANGLING = /[\s,;:.\-–—]+$/;

export const DEFAULT_MAX = 160;

/**
 * Collapse to a single line, trim to `max` characters on a word boundary, and add an
 * ellipsis only when something was actually removed.
 *
 * Uses the single ellipsis character rather than three dots: search engines count
 * characters, and it reads the same for two fewer.
 */
export function metaDescription(
  raw: string | null | undefined,
  max: number = DEFAULT_MAX
): string | null {
  if (!raw) return null;

  const text = raw.replace(ATTRIBUTION, '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  if (text.length <= max) return text;

  const slice = text.slice(0, max + 1);
  const lastSpace = slice.lastIndexOf(' ');

  // Fall back to a hard cut only if the last word is absurdly long — otherwise a
  // single unbroken string would collapse the description to nothing.
  const cut = lastSpace > max * 0.5 ? slice.slice(0, lastSpace) : slice.slice(0, max);

  return cut.replace(DANGLING, '') + '…';
}

/**
 * Synopses that are not synopses.
 *
 * About one show in six carries MyAnimeList's "No synopsis information has been
 * added to this title…" (or the AniDB-style "No synopsis has been added for this
 * series yet"), and a handful hold `__debezium_unavailable_value`, the marker CDC
 * writes for a TOASTed column it did not capture. Served as the meta description,
 * every one of those pages read identically to a crawler.
 */
const PLACEHOLDER = /no synopsis (?:information )?has been added|__debezium_unavailable_value/i;

/** True when there is prose about the title worth showing a reader or a crawler. */
export function hasRealSynopsis(raw: string | null | undefined): boolean {
  if (!raw || !raw.trim()) return false;
  return !PLACEHOLDER.test(raw);
}

/** The synopsis, or null when it is empty or a placeholder. */
export function realSynopsis(raw: string | null | undefined): string | null {
  return hasRealSynopsis(raw) ? raw! : null;
}

/** Placeholder entries in MyAnimeList's studio list. */
const NO_STUDIO = /^\s*(none found|add some|unknown)\s*$/i;

export interface AnimeFacts {
  title: string;
  type?: string | null;
  startDate?: string | null;
  studios?: string[] | null;
  tags?: string[] | null;
  episodeCount?: number | null;
  animeStatus?: string | null;
  source?: string | null;
}

/**
 * A description built from what the record does know, for a show with no synopsis.
 *
 * "OVA (2026) by T-Rex, adapted from a manga. Currently airing. Track episodes…"
 * says something specific to the page, where the old fallback was one sentence
 * shared by every synopsis-less show. Each clause is dropped when its field is
 * missing rather than rendered as "by undefined".
 */
export function animeFactsDescription(facts: AnimeFacts, max: number = DEFAULT_MAX): string {
  const year = /^(\d{4})/.exec(facts.startDate ?? '')?.[1];
  // MyAnimeList's "None found, add some" arrives split into two studio names.
  const studios = (facts.studios ?? []).filter((x) => x && !NO_STUDIO.test(x)).slice(0, 2);
  const genres = (facts.tags ?? []).filter(Boolean).slice(0, 3);

  const lead = [facts.type || 'Anime', year ? `(${year})` : null].filter(Boolean).join(' ');
  const parts = [`${facts.title}: ${lead}${studios.length ? ` by ${studios.join(' & ')}` : ''}`];

  const source = facts.source && !/original|other|unknown/i.test(facts.source) ? facts.source.toLowerCase() : null;
  if (source) parts[0] += `, adapted from ${/^[aeiou]/.test(source) ? 'an' : 'a'} ${source}`;
  if (genres.length) parts.push(genres.join(', '));
  if (facts.episodeCount && facts.episodeCount > 1) parts.push(`${facts.episodeCount} episodes`);
  if (facts.animeStatus && !/finished/i.test(facts.animeStatus)) parts.push(facts.animeStatus);

  const text = `${parts.join('. ')}. Track episodes and add it to your list on WeebVIP.`;
  return metaDescription(text, max) ?? text;
}

/**
 * Whether a show's page should stay out of the index.
 *
 * Only a finished show with no synopsis: its page is a title, a poster and
 * metadata, and five thousand of those are what made Google file the whole
 * catalogue under "Discovered – currently not indexed". An airing or upcoming
 * show is kept even without one -- those are what people are searching for
 * right now (the site's top query is one), and MyAnimeList fills the synopsis
 * in within weeks of airing.
 */
export function isThinAnime(a: { description?: string | null; animeStatus?: string | null }): boolean {
  return !hasRealSynopsis(a.description) && /finished/i.test(a.animeStatus ?? '');
}

const WORK_TYPE_LABEL: Record<string, string> = {
  MANGA: 'Manga',
  LIGHT_NOVEL: 'Light novel',
  NOVEL: 'Novel',
  MANHWA: 'Manhwa',
  MANHUA: 'Manhua',
  ONE_SHOT: 'One-shot',
  DOUJINSHI: 'Doujinshi'
};

export interface WorkFacts {
  title: string;
  type?: string | null;
  authors?: string[] | null;
  publishedFrom?: string | null;
  volumes?: number | null;
  chapters?: number | null;
  status?: string | null;
}

/** animeFactsDescription for a manga or novel: "Manga by Asano, Inio (2014). 12 volumes. …" */
export function workFactsDescription(facts: WorkFacts, max: number = DEFAULT_MAX): string {
  const year = /^(\d{4})/.exec(facts.publishedFrom ?? '')?.[1];
  const authors = (facts.authors ?? []).filter(Boolean).slice(0, 2);
  const label = (facts.type && WORK_TYPE_LABEL[facts.type]) || 'Manga';

  const parts = [
    `${facts.title}: ${label}${authors.length ? ` by ${authors.join(' & ')}` : ''}${year ? ` (${year})` : ''}`
  ];
  if (facts.volumes && facts.volumes > 0) parts.push(`${facts.volumes} volume${facts.volumes === 1 ? '' : 's'}`);
  else if (facts.chapters && facts.chapters > 0) parts.push(`${facts.chapters} chapters`);
  if (facts.status && !/finished/i.test(facts.status)) parts.push(facts.status);

  const text = `${parts.join('. ')}. Track it and its anime adaptations on WeebVIP.`;
  return metaDescription(text, max) ?? text;
}

/**
 * isThinAnime for works. About three works in ten have no synopsis at all,
 * mostly finished one-shots and doujinshi; a series still publishing is kept.
 */
export function isThinWork(w: { synopsis?: string | null; status?: string | null }): boolean {
  return !hasRealSynopsis(w.synopsis) && !/publishing/i.test(w.status ?? '');
}
