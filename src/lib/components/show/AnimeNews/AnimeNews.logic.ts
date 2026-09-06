/**
 * Everything the news rail decides: the category colour, which brand glyph a
 * reference gets, and the ordering/grouping of the entries themselves.
 *
 * The view renders `newsRailView(...)` and a handful of formatted strings; none
 * of the sorting, slicing or date parsing below is visible from the markup.
 */

// Category → colour. Semantic rather than decorative: the reader learns the
// code once. The set is NOT closed — the research model can emit anything —
// so anything unrecognised falls back to muted instead of rendering unstyled.
const CATEGORY_COLORS: Record<string, string> = {
  announcement: 'var(--weeb-accent)',
  release: 'var(--weeb-green)',
  staff: 'var(--weeb-violet)',
  reception: 'var(--weeb-amber)'
};

export function colorFor(category: string | null | undefined): string {
  return CATEGORY_COLORS[(category || '').toLowerCase()] || 'var(--weeb-fg-muted)';
}

/**
 * Brand glyph per referenced host, so "where does this go" reads before the label.
 * Inline rather than fetched: a remote favicon is a third-party request per row and
 * several of these hosts 403 hotlinked assets — the same reason StreamingPlatforms
 * self-hosts its logos under /assets/streams.
 */
const SOURCE_ICONS: Record<string, NewsSourceIcon> = {
  youtube: {
    brand: 'oklch(58% 0.22 27)',
    d: 'M11.4 3.6c-.13-.5-.5-.88-1-1C9.5 2.4 6 2.4 6 2.4s-3.5 0-4.4.2c-.5.12-.87.5-1 1C.4 4.5.4 6 .4 6s0 1.5.2 2.4c.13.5.5.88 1 1 .9.2 4.4.2 4.4.2s3.5 0 4.4-.2c.5-.12.87-.5 1-1 .2-.9.2-2.4.2-2.4s0-1.5-.2-2.4zM4.8 7.8V4.2L7.9 6 4.8 7.8z'
  },
  x: {
    brand: 'oklch(88% 0.01 270)',
    d: 'M9.2 1h1.7L7.2 5.2l4.4 5.8H8.2L5.6 7.6 2.6 11H.9l4-4.5L.7 1h3.5l2.4 3.2L9.2 1zm-.6 9h.9L3.5 1.9h-1L8.6 10z'
  },
  niconico: {
    brand: 'oklch(72% 0.16 250)',
    d: 'M1 3h10v6H8.2l-1.1 2-1.1-2H1V3zm1.4 1.4v3.2h7.2V4.4H2.4z'
  },
  vimeo: {
    brand: 'oklch(72% 0.14 210)',
    d: 'M11.6 3.7c-.05 1.1-.83 2.63-2.33 4.57C7.72 10.3 6.4 11.3 5.3 11.3c-.68 0-1.26-.63-1.73-1.9L2.63 6.06C2.28 4.8 1.9 4.17 1.5 4.17c-.09 0-.39.18-.9.53L.06 4.03c.63-.55 1.25-1.1 1.86-1.66.84-.72 1.47-1.1 1.89-1.14.99-.1 1.6.58 1.83 2.02.25 1.56.42 2.53.52 2.91.29 1.3.6 1.95.95 1.95.27 0 .67-.42 1.2-1.27.53-.85.82-1.5.86-1.94.08-.79-.23-1.19-.94-1.19-.33 0-.68.08-1.03.23.68-2.24 1.99-3.33 3.92-3.27 1.43.04 2.1.97 2.02 2.79z'
  },
  site: {
    brand: 'var(--weeb-accent-hover)',
    d: 'M6 .8a5.2 5.2 0 100 10.4A5.2 5.2 0 006 .8zm3.6 3.4H8.1a8 8 0 00-.8-2.1 4.2 4.2 0 012.3 2.1zM6 1.9c.4.5.7 1.3.9 2.3H5.1c.2-1 .5-1.8.9-2.3zM1.9 6c0-.3 0-.6.1-.9h1.7a9.6 9.6 0 000 1.8H2c0-.3-.1-.6-.1-.9zm.5 1.8h1.5c.2.8.4 1.5.8 2.1a4.2 4.2 0 01-2.3-2.1zm1.5-3.6H2.4a4.2 4.2 0 012.3-2.1 8 8 0 00-.8 2.1zM6 10.1c-.4-.5-.7-1.3-.9-2.3h1.8c-.2 1-.5 1.8-.9 2.3zm1.1-3.4H4.9a8.7 8.7 0 010-1.4h2.2a8.7 8.7 0 010 1.4zm.2 3.2c.4-.6.6-1.3.8-2.1h1.5a4.2 4.2 0 01-2.3 2.1zM8.3 6a9.6 9.6 0 000-1.8H10a4.3 4.3 0 010 1.8H8.3z'
  },
  link: {
    brand: 'var(--weeb-fg-muted)',
    outline: true,
    d: 'M5 7l-1.4 1.4a2 2 0 01-2.8-2.8L2.2 4.2M7 5l1.4-1.4a2 2 0 012.8 2.8L9.8 7.8M4.6 7.4l2.8-2.8'
  }
};

export interface NewsSourceIcon {
  brand: string;
  d: string;
  outline?: boolean;
}

/** One month's worth of entries, in the order the rail draws them. */
export interface NewsGroup {
  label: string;
  items: any[];
}

/** What the rail renders: the grouped entries, and how many were left out. */
export interface NewsRailView {
  groups: NewsGroup[];
  /** Entries that survived filtering, before `limit` was applied. */
  total: number;
  hiddenCount: number;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function sourceIcon(url: string, kind: string | null | undefined): NewsSourceIcon {
  const h = hostOf(url);
  if (h.includes('youtube') || h.includes('youtu.be')) return SOURCE_ICONS.youtube;
  if (h.includes('nicovideo')) return SOURCE_ICONS.niconico;
  if (h.includes('vimeo')) return SOURCE_ICONS.vimeo;
  if (h === 'x.com' || h.includes('twitter')) return SOURCE_ICONS.x;
  if (kind === 'site') return SOURCE_ICONS.site;
  return SOURCE_ICONS.link;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

const MONTH_FMT = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' });
const DAY_FMT = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' });

/** The day chip beside a headline; an unparseable date is a dash, never "Invalid Date". */
export function dayLabel(value: string | null | undefined): string {
  const d = parseDate(value);
  return d ? DAY_FMT.format(d) : '\u2014';
}

/**
 * Newest first, grouped by month. Items with no usable publishedDate keep their
 * relative order and collect in a trailing "Undated" group -- one of the twelve
 * staging items has none, and it must never render as "Invalid Date".
 *
 * Sorting happens before slicing: "latest 5" must mean the 5 newest, not the
 * first 5 the API happened to return.
 */
export function newsRailView(news: any[] | undefined, limit: number | null): NewsRailView {
  const usable = (news || []).filter((n) => n && (n.title || '').trim());

  const dated = usable
    .map((n) => ({ item: n, date: parseDate(n.publishedDate) }))
    .filter((x) => x.date !== null) as { item: any; date: Date }[];
  dated.sort((a, b) => b.date.getTime() - a.date.getTime());
  const undated = usable.filter((n) => parseDate(n.publishedDate) === null);
  const ordered = [...dated.map((d) => d.item), ...undated];

  const visible = limit === null ? ordered : ordered.slice(0, limit);

  const groups: NewsGroup[] = [];
  for (const item of visible) {
    const d = parseDate(item.publishedDate);
    const label = d ? MONTH_FMT.format(d) : 'Undated';
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }

  return { groups, total: usable.length, hiddenCount: Math.max(0, usable.length - visible.length) };
}
