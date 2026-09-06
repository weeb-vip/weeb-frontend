import { describe, it, expect } from 'vitest';
import { colorFor, dayLabel, hostOf, newsRailView, sourceIcon } from './AnimeNews.logic';

/** One news entry, with only the fields the rail actually reads. */
const item = (title: string, publishedDate: string | null) => ({ title, publishedDate });

describe('colorFor', () => {
  it('gives each known category its own colour', () => {
    expect(colorFor('announcement')).toBe('var(--weeb-accent)');
    expect(colorFor('release')).toBe('var(--weeb-green)');
    expect(colorFor('staff')).toBe('var(--weeb-violet)');
    expect(colorFor('reception')).toBe('var(--weeb-amber)');
  });

  it('matches whatever case the model emitted', () => {
    expect(colorFor('RELEASE')).toBe('var(--weeb-green)');
    expect(colorFor('Staff')).toBe('var(--weeb-violet)');
  });

  it('falls back to muted rather than rendering unstyled', () => {
    // The set is not closed -- the research model can emit anything.
    expect(colorFor('licensing')).toBe('var(--weeb-fg-muted)');
    expect(colorFor(null)).toBe('var(--weeb-fg-muted)');
    expect(colorFor(undefined)).toBe('var(--weeb-fg-muted)');
    expect(colorFor('')).toBe('var(--weeb-fg-muted)');
  });
});

describe('hostOf', () => {
  it('drops the www so the host reads as the brand', () => {
    expect(hostOf('https://www.crunchyroll.com/news/x')).toBe('crunchyroll.com');
  });

  it('keeps any other subdomain', () => {
    expect(hostOf('https://news.mynavi.jp/x')).toBe('news.mynavi.jp');
  });

  it('is empty for anything that is not a URL', () => {
    expect(hostOf('not a url')).toBe('');
    expect(hostOf('')).toBe('');
  });
});

describe('sourceIcon', () => {
  it('recognises the video hosts by their several domains', () => {
    const youtube = sourceIcon('https://www.youtube.com/watch?v=1', null);

    expect(sourceIcon('https://youtu.be/abc', null)).toBe(youtube);
    expect(sourceIcon('https://www.nicovideo.jp/watch/1', null)).not.toBe(youtube);
    expect(sourceIcon('https://vimeo.com/1', null)).not.toBe(youtube);
  });

  it('treats x.com and twitter.com as the same brand', () => {
    expect(sourceIcon('https://x.com/user/status/1', null)).toBe(
      sourceIcon('https://twitter.com/user/status/1', null)
    );
  });

  it('does not mistake a host that merely contains "x" for X', () => {
    expect(sourceIcon('https://max.example.com/a', null)).not.toBe(
      sourceIcon('https://x.com/a', null)
    );
  });

  it('falls back to the outlined link glyph, and only that one is outlined', () => {
    const link = sourceIcon('https://some-blog.example/a', null);

    expect(link.outline).toBe(true);
    expect(sourceIcon('https://some-blog.example/a', 'site').outline).toBeUndefined();
  });

  it('uses the globe for an official site, whatever its host', () => {
    expect(sourceIcon('https://frieren-anime.jp/', 'site')).toBe(
      sourceIcon('https://another-official.jp/', 'site')
    );
  });

  it('lets the host win over the kind', () => {
    // A YouTube link tagged "site" is still a YouTube link.
    expect(sourceIcon('https://www.youtube.com/@channel', 'site')).toBe(
      sourceIcon('https://www.youtube.com/@channel', null)
    );
  });

  it('has an icon for a URL that will not parse at all', () => {
    expect(sourceIcon('nonsense', null).d).toBeTruthy();
  });
});

describe('dayLabel', () => {
  it('is a short month and day', () => {
    expect(dayLabel('2024-03-15T00:00:00Z')).toMatch(/^Mar \d{1,2}$/);
  });

  it('is a dash, never "Invalid Date"', () => {
    expect(dayLabel(null)).toBe('—');
    expect(dayLabel(undefined)).toBe('—');
    expect(dayLabel('')).toBe('—');
    expect(dayLabel('sometime last spring')).toBe('—');
  });
});

describe('newsRailView', () => {
  it('renders nothing at all from nothing', () => {
    for (const empty of [undefined, [] as unknown[]]) {
      const view = newsRailView(empty as never, 5);

      expect(view.groups).toEqual([]);
      expect(view.total).toBe(0);
      expect(view.hiddenCount).toBe(0);
    }
  });

  it('drops entries with no headline to draw', () => {
    const view = newsRailView(
      [item('Real', '2024-03-01'), item('', '2024-03-02'), item('   ', '2024-03-03'), null],
      null
    );

    expect(view.total).toBe(1);
    expect(view.groups[0].items).toHaveLength(1);
  });

  it('sorts before it slices -- "latest 2" means the 2 newest', () => {
    const view = newsRailView(
      [item('oldest', '2024-01-01'), item('newest', '2024-05-01'), item('middle', '2024-03-01')],
      2
    );

    // Not the first two the API happened to return.
    expect(view.groups.flatMap((g) => g.items).map((i) => i.title)).toEqual(['newest', 'middle']);
  });

  it('reports how many it left out, of everything usable', () => {
    const news = [
      item('a', '2024-01-01'),
      item('b', '2024-02-01'),
      item('c', '2024-03-01'),
      item('', '2024-04-01')
    ];

    const view = newsRailView(news, 2);

    expect(view.total).toBe(3);
    expect(view.hiddenCount).toBe(1);
  });

  it('hides nothing when there is no limit, or the limit is generous', () => {
    const news = [item('a', '2024-01-01'), item('b', '2024-02-01')];

    expect(newsRailView(news, null).hiddenCount).toBe(0);
    expect(newsRailView(news, 10).hiddenCount).toBe(0);
    expect(newsRailView(news, null).groups.flatMap((g) => g.items)).toHaveLength(2);
  });

  it('groups by month, newest month first', () => {
    const view = newsRailView(
      [
        item('feb', '2024-02-10T12:00:00Z'),
        item('mar-late', '2024-03-28T12:00:00Z'),
        item('mar-early', '2024-03-02T12:00:00Z')
      ],
      null
    );

    expect(view.groups.map((g) => g.label)).toEqual(['March 2024', 'February 2024']);
    expect(view.groups[0].items.map((i) => i.title)).toEqual(['mar-late', 'mar-early']);
  });

  it('separates the same month in different years', () => {
    const view = newsRailView(
      [item('this year', '2024-03-15T12:00:00Z'), item('last year', '2023-03-15T12:00:00Z')],
      null
    );

    expect(view.groups.map((g) => g.label)).toEqual(['March 2024', 'March 2023']);
  });

  it('collects undated entries into a trailing group, in their original order', () => {
    const view = newsRailView(
      [
        item('no date 1', null),
        item('dated', '2024-03-15T12:00:00Z'),
        item('no date 2', 'not a date')
      ],
      null
    );

    const last = view.groups[view.groups.length - 1];
    expect(last.label).toBe('Undated');
    expect(last.items.map((i) => i.title)).toEqual(['no date 1', 'no date 2']);
    // And never as "Invalid Date".
    expect(view.groups.map((g) => g.label)).not.toContain('Invalid Date');
  });

  it('puts every undated entry behind every dated one', () => {
    const view = newsRailView([item('undated', null), item('dated', '2020-01-15T12:00:00Z')], null);

    expect(view.groups.map((g) => g.label)).toEqual(['January 2020', 'Undated']);
  });

  it('can slice away the dated entries entirely', () => {
    const view = newsRailView([item('dated', '2024-03-01'), item('undated', null)], 1);

    expect(view.groups).toHaveLength(1);
    expect(view.groups[0].label).not.toBe('Undated');
    expect(view.hiddenCount).toBe(1);
  });

  it('shows nothing at a limit of zero, while still counting what it has', () => {
    const view = newsRailView([item('a', '2024-01-01')], 0);

    expect(view.groups).toEqual([]);
    expect(view.total).toBe(1);
    expect(view.hiddenCount).toBe(1);
  });
});
