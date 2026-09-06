import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import HeroAiringRail from './HeroAiringRail.svelte';
import { RAIL_LIMIT } from './HeroAiringRail.logic';

/**
 * The panel of upcoming episodes beside the hero banner.
 *
 * Presentational: every row is drawn from an entry HomepageSSR already
 * resolved, and the two singletons it needs -- the title language and the
 * analytics ping -- arrive as ports, so both are injected here rather than
 * mocked at the module boundary.
 *
 * How many rows fit and what the three short strings on a row say are decided
 * in `HeroAiringRail.logic` and asserted there. This file is the markup and the
 * wiring: the ARIA shape of the panel, that a row is a link to the show, and
 * that hovering, focusing and clicking one report what they should.
 *
 * The covers are `SafeImage`s, which pick a source by loading candidates.
 * jsdom loads no images, so there is no `<img>` to assert on and the alt text
 * is empty by design (the row's own title names it) -- the artwork belongs to
 * the visual layer.
 */

const entry = (
  id: string,
  overrides: { titleEn?: string; titleJp?: string; slug?: string | null; timing?: any; episode?: number } = {}
) => ({
  anime: {
    id,
    slug: overrides.slug === undefined ? id : overrides.slug,
    titleEn: overrides.titleEn ?? `Show ${id}`,
    titleJp: overrides.titleJp ?? `ショー ${id}`
  },
  airingInfo: {
    nextEpisode: { episodeNumber: overrides.episode ?? 3 },
    timing: overrides.timing ?? {
      isLive: false,
      hasAired: false,
      countdown: '15h',
      localTime: '7:30 AM'
    }
  }
});

const english = () => 'english' as const;

describe('HeroAiringRail', () => {
  it('renders nothing at all when there is nothing airing', () => {
    const { container } = render(HeroAiringRail, {
      props: { entries: [], titleLanguage: english, track: () => {} }
    });

    expect(container.textContent).toBe('');
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('is a named complementary region with a heading and a link to the full schedule', () => {
    render(HeroAiringRail, {
      props: { entries: [entry('a1')], titleLanguage: english, track: () => {} }
    });

    const rail = screen.getByRole('complementary', { name: 'Airing next' });
    expect(within(rail).getByRole('heading', { name: 'Airing Next' })).toBeInTheDocument();
    expect(within(rail).getByRole('link', { name: /Full schedule/ })).toHaveAttribute(
      'href',
      '/airing'
    );
  });

  describe('the rows', () => {
    it('draws one link per entry, addressed by slug', () => {
      render(HeroAiringRail, {
        props: {
          entries: [entry('a1', { titleEn: 'Frieren', slug: 'frieren' }), entry('a2')],
          titleLanguage: english,
          track: () => {}
        }
      });

      expect(screen.getByRole('link', { name: /Frieren/ })).toHaveAttribute('href', '/anime/frieren');
      expect(screen.getAllByRole('listitem')).toHaveLength(2);
    });

    it('falls back to the id when a show has no slug', () => {
      render(HeroAiringRail, {
        props: {
          entries: [entry('a 1', { titleEn: 'Frieren', slug: null })],
          titleLanguage: english,
          track: () => {}
        }
      });

      expect(screen.getByRole('link', { name: /Frieren/ })).toHaveAttribute('href', '/anime/a%201');
    });

    /**
     * The panel is sized by the banner behind it, not by the data. Anything
     * past the limit is dropped here rather than hidden with CSS, so the extra
     * rows are not in the accessibility tree either.
     */
    it('stops at the rail limit', () => {
      const entries = Array.from({ length: RAIL_LIMIT + 4 }, (_, i) => entry(`a${i}`));
      render(HeroAiringRail, { props: { entries, titleLanguage: english, track: () => {} } });

      expect(screen.getAllByRole('listitem')).toHaveLength(RAIL_LIMIT);
    });

    it('prints the episode, the local air time and the countdown', () => {
      render(HeroAiringRail, {
        props: {
          entries: [entry('a1', { titleEn: 'Frieren', episode: 12 })],
          titleLanguage: english,
          track: () => {}
        }
      });

      const row = screen.getByRole('link', { name: /Frieren/ });
      expect(row).toHaveTextContent('EP 12');
      expect(row).toHaveTextContent('7:30 AM');
      expect(row).toHaveTextContent('in 15h');
    });

    it('leaves out the episode line for an entry with no next episode', () => {
      render(HeroAiringRail, {
        props: {
          entries: [entry('a1', { titleEn: 'Frieren', episode: 0 })],
          titleLanguage: english,
          track: () => {}
        }
      });

      expect(screen.getByRole('link', { name: /Frieren/ })).not.toHaveTextContent('EP');
    });

    it('marks a show that is on the air now', () => {
      const { container } = render(HeroAiringRail, {
        props: {
          entries: [
            entry('a1', {
              titleEn: 'Frieren',
              timing: { isLive: true, countdown: 'AIRING NOW', localTime: '7:30 AM' }
            })
          ],
          titleLanguage: english,
          track: () => {}
        }
      });

      const row = screen.getByRole('link', { name: /Frieren/ });
      expect(row).toHaveTextContent('Now');
      // The one shared "on the air" mark, rather than a second dot of its own.
      expect(container.querySelector('.rail-when.is-live')).toBeInTheDocument();
    });
  });

  describe('the title language', () => {
    it('draws the title in the reader’s language', () => {
      const props = {
        entries: [entry('a1', { titleEn: 'Frieren', titleJp: '葬送のフリーレン' })],
        track: () => {}
      };

      const inEnglish = render(HeroAiringRail, {
        props: { ...props, titleLanguage: () => 'english' as const }
      });
      expect(inEnglish.getByText('Frieren')).toBeInTheDocument();
      inEnglish.unmount();

      render(HeroAiringRail, { props: { ...props, titleLanguage: () => 'japanese' as const } });
      expect(screen.getByText('葬送のフリーレン')).toBeInTheDocument();
    });
  });

  describe('what a row reports', () => {
    it('retargets the banner on hover', async () => {
      const onSelect = vi.fn();
      const rows = [entry('a1', { titleEn: 'Frieren' })];
      render(HeroAiringRail, {
        props: { entries: rows, onSelect, titleLanguage: english, track: () => {} }
      });

      await userEvent.hover(screen.getByRole('link', { name: /Frieren/ }));

      expect(onSelect).toHaveBeenCalledWith(rows[0].airingInfo);
    });

    /**
     * A keyboard reader must be able to retarget the banner too -- hover alone
     * would make the rail's whole purpose mouse-only.
     */
    it('retargets the banner on focus as well', async () => {
      const onSelect = vi.fn();
      const rows = [entry('a1', { titleEn: 'Frieren' })];
      render(HeroAiringRail, {
        props: { entries: rows, onSelect, titleLanguage: english, track: () => {} }
      });

      screen.getByRole('link', { name: /Frieren/ }).focus();

      expect(onSelect).toHaveBeenCalledWith(rows[0].airingInfo);
    });

    it('reports the opened show with its resolved title', async () => {
      const track = vi.fn();
      render(HeroAiringRail, {
        props: {
          entries: [entry('a1', { titleEn: 'Frieren', titleJp: '葬送のフリーレン' })],
          titleLanguage: () => 'japanese' as const,
          track
        }
      });

      await userEvent.click(screen.getByRole('link', { name: /葬送のフリーレン/ }));

      expect(track).toHaveBeenCalledWith('a1', '葬送のフリーレン');
    });
  });

  describe('the active row', () => {
    it('says which row the banner is currently showing', () => {
      render(HeroAiringRail, {
        props: {
          entries: [entry('a1', { titleEn: 'Frieren' }), entry('a2', { titleEn: 'Dandadan' })],
          activeId: 'a2',
          titleLanguage: english,
          track: () => {}
        }
      });

      expect(screen.getByRole('link', { name: /Dandadan/ })).toHaveAttribute('aria-current', 'true');
      expect(screen.getByRole('link', { name: /Frieren/ })).not.toHaveAttribute('aria-current');
    });

    it('marks nothing when the banner is showing something not in the rail', () => {
      render(HeroAiringRail, {
        props: {
          entries: [entry('a1', { titleEn: 'Frieren' })],
          activeId: 'z9',
          titleLanguage: english,
          track: () => {}
        }
      });

      expect(screen.getByRole('link', { name: /Frieren/ })).not.toHaveAttribute('aria-current');
    });
  });
});
