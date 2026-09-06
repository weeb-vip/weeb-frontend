import { collapseSeasonParts } from '$lib/services/utils';

/**
 * How the related rail is grouped and ordered.
 *
 * The view draws headed shelves; which shelves exist, what they are called, in
 * what order, and which entries land in each is all decided here.
 */

/** One headed shelf of the rail. */
export interface RelatedGroup {
  kind: string;
  heading: string;
  items: any[];
}

/**
 * Heading per relation kind. Entries in the same series are not "related" to
 * this anime -- they are this anime, in another form -- so they get their own
 * heading rather than being pooled with genuinely separate works.
 *
 * Unknown kinds fall back rather than vanishing: the API will grow kinds
 * (a shared source work, a shared creator) before this list learns their
 * names, and silently dropping them would hide data the server sent.
 */
const HEADINGS: Record<string, string> = {
  SAME_SERIES: 'Same series'
};
const FALLBACK_HEADING = 'Related';

// Order the headings deliberately; same-series first, since it is the
// closest relationship and the one most readers are looking for.
const ORDER = ['SAME_SERIES'];

/** Air-date order, undated last: an unaired special should not open the history of a series that began in 1998. */
function byAirDate(a: any, b: any): number {
  if (!a.startDate && !b.startDate) return 0;
  if (!a.startDate) return 1;
  if (!b.startDate) return -1;
  return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
}

export function relatedGroups(related: any[], current: any): RelatedGroup[] {
  const byKind = new Map<string, any[]>();
  for (const entry of related) {
    if (!entry?.anime) continue;
    const kind = entry.relation || FALLBACK_HEADING;
    if (!byKind.has(kind)) byKind.set(kind, []);
    byKind.get(kind)!.push(entry.anime);
  }

  // The current anime belongs in the same-series timeline, where the ordering
  // means something. It is not added to other kinds: a spin-off list has no
  // "you are here" position.
  const sameSeries = byKind.get('SAME_SERIES');
  if (sameSeries && current) {
    sameSeries.push({ ...current, isCurrent: true });
  }

  // A season split across two cours is one season, so the timeline lists only
  // the original of each. The anime being viewed is kept whatever it is: on
  // the page for a Part 2, the reader still has to see where they are.
  if (sameSeries) {
    byKind.set('SAME_SERIES', collapseSeasonParts(sameSeries, current ? [current.id] : []));
  }

  const kinds = [...byKind.keys()].sort((a, b) => {
    const ai = ORDER.indexOf(a);
    const bi = ORDER.indexOf(b);
    return (ai === -1 ? ORDER.length : ai) - (bi === -1 ? ORDER.length : bi);
  });

  return kinds.map((kind) => ({
    kind,
    heading: HEADINGS[kind] ?? FALLBACK_HEADING,
    items: byKind.get(kind)!.slice().sort(byAirDate)
  }));
}

export function entryHref(entry: any): string {
  return `/anime/${entry.slug || entry.id}`;
}

/** TV is the through-line of a series; everything else hangs off it. */
export function isMainEntry(type: string | null | undefined): boolean {
  return (type || '').toLowerCase() === 'tv';
}
