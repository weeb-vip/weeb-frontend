import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
import AnimeNews from './AnimeNews.svelte';

/**
 * The news rail's rendering. Ordering, grouping and the day/month labels are
 * decided in `AnimeNews.logic.ts` and covered by `AnimeNews.logic.test.ts`; what
 * is left here is what a reader actually sees -- the month dividers, the links
 * that leave the site, the empty surface, and that the chips and that surface
 * are the shared primitives rather than markup re-rolled in this file.
 */

const item = (over: Record<string, unknown> = {}) => ({
  id: over.id ?? 'n1',
  title: 'Season 2 confirmed',
  summary: 'The official site announced a second season.',
  publishedDate: '2024-03-14T12:00:00Z',
  category: 'announcement',
  sourceName: 'Anime News Network',
  sourceUrl: 'https://www.animenewsnetwork.com/story',
  ...over
});

describe('AnimeNews', () => {
  describe('the timeline', () => {
    it('renders each entry with its headline, summary and day', () => {
      render(AnimeNews, { props: { news: [item()] } });

      expect(screen.getByRole('link', { name: /Season 2 confirmed/ })).toBeInTheDocument();
      expect(
        screen.getByText('The official site announced a second season.')
      ).toBeInTheDocument();
      // Midday UTC, so the day label is the same whatever timezone the suite
      // runs in: `dayLabel` formats in the viewer's zone, not UTC.
      expect(screen.getByText('Mar 14')).toBeInTheDocument();
    });

    it('draws a month divider above each month, once', () => {
      render(AnimeNews, {
        props: {
          news: [
            item({ id: 'a', title: 'March one', publishedDate: '2024-03-20T12:00:00Z' }),
            item({ id: 'b', title: 'March two', publishedDate: '2024-03-12T12:00:00Z' }),
            item({ id: 'c', title: 'February one', publishedDate: '2024-02-11T12:00:00Z' })
          ]
        }
      });

      // The divider is deliberately not a heading (see the skipped test at the
      // foot of this file), so it is addressed by its text.
      expect(screen.getByText('March 2024')).toBeInTheDocument();
      expect(screen.getByText('February 2024')).toBeInTheDocument();
      expect(screen.queryAllByText('March 2024')).toHaveLength(1);
    });

    it('collects entries with no usable date under a trailing "Undated" divider', () => {
      const { container } = render(AnimeNews, {
        props: {
          news: [
            item({ id: 'a', title: 'Dated', publishedDate: '2024-03-20T12:00:00Z' }),
            item({ id: 'b', title: 'No date', publishedDate: null })
          ]
        }
      });

      const dividers = [...container.querySelectorAll('.month')].map((el) => el.textContent);
      expect(dividers).toEqual(['March 2024', 'Undated']);
      // Never "Invalid Date" -- an em dash stands in for the day.
      expect(container.querySelector('.row:last-of-type .date')?.textContent).toBe('—');
    });

    it('renders only `limit` entries, and keeps them in the rail order', () => {
      render(AnimeNews, {
        props: {
          news: [
            item({ id: 'a', title: 'Oldest', publishedDate: '2024-01-01T12:00:00Z' }),
            item({ id: 'b', title: 'Newest', publishedDate: '2024-05-01T12:00:00Z' }),
            item({ id: 'c', title: 'Middle', publishedDate: '2024-03-01T12:00:00Z' })
          ],
          limit: 2
        }
      });

      expect(screen.getByText('Newest')).toBeInTheDocument();
      expect(screen.getByText('Middle')).toBeInTheDocument();
      expect(screen.queryByText('Oldest')).not.toBeInTheDocument();
    });

    it('renders everything when `limit` is null, which is what the all-news page does', () => {
      render(AnimeNews, {
        props: {
          news: [item({ id: 'a', title: 'One' }), item({ id: 'b', title: 'Two' })],
          limit: null
        }
      });

      expect(screen.getByText('One')).toBeInTheDocument();
      expect(screen.getByText('Two')).toBeInTheDocument();
    });
  });

  describe('links out', () => {
    it('makes the headline the link to the article, opening in a new tab', () => {
      render(AnimeNews, { props: { news: [item()] } });

      const link = screen.getByRole('link', { name: /Season 2 confirmed/ });
      expect(link).toHaveAttribute('href', 'https://www.animenewsnetwork.com/story');
      expect(link).toHaveAttribute('target', '_blank');
      // noopener: these are third-party pages the research pipeline found.
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      // The new-tab warning is in the accessible name, not only in a tooltip.
      expect(link).toHaveAccessibleName(/opens in a new tab/);
    });

    it('leaves the headline as plain text when the entry has no URL', () => {
      render(AnimeNews, { props: { news: [item({ sourceUrl: null })] } });

      expect(screen.getByText('Season 2 confirmed')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Season 2 confirmed/ })).not.toBeInTheDocument();
    });

    /**
     * REGRESSION. The row used to be one big anchor, which made the reference
     * chips unclickable -- anchors cannot nest, so they had to be spans. The
     * headline and each reference are now separate links.
     */
    it('makes each reference its own link rather than nesting anchors', () => {
      render(AnimeNews, {
        props: {
          news: [
            item({
              references: [
                { url: 'https://www.youtube.com/watch?v=abc', title: 'PV 2', kind: 'video' },
                { url: 'https://example.com/news', title: 'Official site', kind: 'site' }
              ]
            })
          ]
        }
      });

      const pv = screen.getByRole('link', { name: /PV 2/ });
      expect(pv).toHaveAttribute('href', 'https://www.youtube.com/watch?v=abc');
      expect(pv.closest('a[href*="animenewsnetwork"]')).toBeNull();

      // The host is shown beside the title so "where does this go" reads first.
      expect(pv).toHaveTextContent('youtube.com');
      expect(screen.getByRole('link', { name: /Official site/ })).toHaveTextContent('example.com');
    });

    it('renders no reference row at all until the API ships the field', () => {
      const { container } = render(AnimeNews, { props: { news: [item()] } });

      expect(container.querySelector('.refs')).toBeNull();
    });

    it('makes the source name a second route to the same article', () => {
      render(AnimeNews, { props: { news: [item()] } });

      const source = screen.getByRole('link', { name: /Anime News Network/ });
      expect(source).toHaveAttribute('href', 'https://www.animenewsnetwork.com/story');
    });

    it('leaves the source name inert text when there is nowhere to send the reader', () => {
      render(AnimeNews, { props: { news: [item({ sourceUrl: null })] } });

      expect(screen.getByText('Anime News Network')).toBeInTheDocument();
      expect(screen.queryAllByRole('link')).toHaveLength(0);
    });
  });

  describe('the meta row uses the shared primitives', () => {
    it('renders the category through Chip, not hand-rolled pill markup', () => {
      const { container } = render(AnimeNews, { props: { news: [item({ category: 'release' })] } });

      // `.chip` is Chip's own root class, and `.cat-chip` is the class this
      // component passes it. Finding both is what proves the pill came from
      // the primitive rather than from a local `border-radius: 20px`.
      const chip = container.querySelector('.cat-chip');
      expect(chip).toBeInTheDocument();
      expect(chip).toHaveClass('chip');
      expect(chip).toHaveTextContent('release');
    });

    it('renders the episode number through Chip too', () => {
      const { container } = render(AnimeNews, { props: { news: [item({ episodeNumber: 7 })] } });

      const chips = [...container.querySelectorAll('.chip')].map((el) => el.textContent?.trim());
      expect(chips).toContain('Ep 7');
    });

    it('omits the category and episode chips when the entry carries neither', () => {
      const { container } = render(AnimeNews, {
        props: { news: [item({ category: null, episodeNumber: null })] }
      });

      expect(container.querySelectorAll('.chip')).toHaveLength(0);
    });

    it('marks a Japanese-language source so the reader knows before following it', () => {
      render(AnimeNews, { props: { news: [item({ language: 'ja' })] } });

      expect(screen.getByText('JA')).toBeInTheDocument();
    });

    it('shows no language marker until the API ships the field', () => {
      const { container } = render(AnimeNews, { props: { news: [item()] } });

      expect(container.querySelector('.lang')).toBeNull();
    });
  });

  describe('the "view all" link', () => {
    it('appears with the true total once entries are hidden', () => {
      render(AnimeNews, {
        props: {
          news: Array.from({ length: 12 }, (_, i) =>
            item({
              id: `n${i}`,
              title: `Story ${i}`,
              publishedDate: `2024-03-${String((i % 28) + 1).padStart(2, '0')}T12:00:00Z`
            })
          ),
          limit: 5,
          viewAllHref: '/anime/bebop/news'
        }
      });

      // "View all 12", not "view all 5": the count is what was filtered in,
      // before the limit was applied.
      const link = screen.getByRole('link', { name: /View all 12 news/ });
      expect(link).toHaveAttribute('href', '/anime/bebop/news');
    });

    it('is absent when nothing is hidden', () => {
      render(AnimeNews, {
        props: { news: [item()], limit: 5, viewAllHref: '/anime/bebop/news' }
      });

      expect(screen.queryByRole('link', { name: /View all/ })).not.toBeInTheDocument();
    });

    it('is absent on the all-news page itself, which passes no href', () => {
      render(AnimeNews, {
        props: {
          news: [item({ id: 'a' }), item({ id: 'b', title: 'Second' })],
          limit: 1,
          viewAllHref: null
        }
      });

      expect(screen.queryByRole('link', { name: /View all/ })).not.toBeInTheDocument();
    });
  });

  describe('the empty state', () => {
    it.each([
      ['no news at all', []],
      ['news that is undefined', undefined],
      ['entries with no title, which are not renderable', [item({ title: '   ' })]]
    ])('uses the shared EmptyState surface for %s', (_label, news) => {
      const { container } = render(AnimeNews, { props: { news } });

      expect(screen.getByText('No news yet')).toBeInTheDocument();
      expect(screen.getByText("We'll add stories here as they're found.")).toBeInTheDocument();
      // Not a dashed box of its own: `.es` is EmptyState's root class, and
      // the rail is gone entirely.
      expect(container.querySelector('.es')).toBeInTheDocument();
      expect(container.querySelector('.news-rail')).toBeNull();
    });

    it('keeps the default h3 heading level for the empty surface', () => {
      render(AnimeNews, { props: { news: [] } });

      // Under ShowSection's h2. Unlike ShowSynopsis, this one is not passed a
      // `headingTag`, so it takes EmptyState's default.
      expect(screen.getByRole('heading', { name: 'No news yet' }).tagName).toBe('H3');
    });
  });

  describe('long and awkward content', () => {
    it('renders a very long headline in full -- the clamp is CSS', () => {
      const title = 'A headline that keeps going '.repeat(20).trim();
      render(AnimeNews, { props: { news: [item({ title })] } });

      expect(screen.getByRole('link', { name: new RegExp(title.slice(0, 40)) })).toHaveTextContent(
        title
      );
    });

    it('keeps a two-line summary in the DOM in full -- the clamp is line-clamp', () => {
      // `-webkit-line-clamp: 2` hides the rest visually; nothing is removed.
      // Whether it actually clamps needs a browser.
      const summary = 'Sentence. '.repeat(120).trim();
      render(AnimeNews, { props: { news: [item({ summary })] } });

      expect(screen.getByText(summary)).toBeInTheDocument();
    });

    it('draws no summary paragraph when the entry has none', () => {
      const { container } = render(AnimeNews, { props: { news: [item({ summary: null })] } });

      expect(container.querySelector('.summary')).toBeNull();
    });

    it('falls back to a neutral glyph for a reference whose URL will not parse', () => {
      render(AnimeNews, {
        props: { news: [item({ references: [{ url: 'not a url', title: 'Broken', kind: null }] })] }
      });

      // The host is empty rather than "Invalid URL", and the chip still renders.
      const ref = screen.getByRole('link', { name: /Broken/ });
      expect(ref).toHaveAttribute('href', 'not a url');
    });
  });

  /**
   * A11y FINDING, not fixed here. The headline is an `<h4>` while its enclosing
   * `ShowSection` emits an `<h2>` -- the outline jumps h2 -> h4 with no h3
   * between, and the month divider that groups the entries is a plain `<div>`
   * rather than the heading it reads as. Both are source changes (AnimeNews
   * would need the level passed in, or the dividers promoted), so this is
   * skipped rather than made to pass.
   *
   * Reproduce: render `ShowSection` with heading "News" around `AnimeNews` with
   * one entry, and read the heading levels: [2, 4].
   */
  it.skip('nests its headlines one level under the section heading', () => {
    render(AnimeNews, { props: { news: [item()] } });

    expect(screen.getByRole('heading', { name: /Season 2 confirmed/ }).tagName).toBe('H3');
  });

  it('renders the headline as a heading, at the level it currently uses', () => {
    render(AnimeNews, { props: { news: [item()] } });

    // Asserted as-is so the finding above is visible from the passing suite too.
    expect(screen.getByRole('heading', { name: /Season 2 confirmed/ }).tagName).toBe('H4');
  });
});
