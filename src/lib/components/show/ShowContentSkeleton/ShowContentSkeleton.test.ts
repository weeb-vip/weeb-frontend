import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ShowContentSkeleton from './ShowContentSkeleton.svelte';
import { sectionTabs } from '$lib/components/show/ShowContent.rules';

/**
 * What the show page looks like before its data arrives.
 *
 * The regression it was rebuilt for is that it used to draw a DIFFERENT page --
 * a centred card over a 600px hero, a sidebar and a tabbed panel -- none of
 * which had existed since the page became ShowHero + ShowQuickInfo + a stack of
 * ShowSections, so the layout jumped the moment the real page painted.
 *
 * A skeleton is almost entirely appearance, and jsdom applies no CSS, so this
 * suite deliberately asserts only the two things that ARE structure: the block
 * stack corresponds one-for-one to what actually loads, and every placeholder
 * is the shared `Skeleton` primitive rather than a bespoke shimmer. "It does
 * not jump when the real page paints" is a visual-diff assertion and belongs to
 * the Playwright layer.
 *
 * The `.skeleton-*` classes are the contract being asserted: a skeleton has no
 * roles, no text and no accessible names by design, so there is nothing else to
 * address it by.
 */
describe('ShowContentSkeleton', () => {
  it('announces itself as one busy region and nothing more', () => {
    render(ShowContentSkeleton, { props: {} });

    const root = screen.getByLabelText('Loading show');
    expect(root).toHaveAttribute('aria-busy', 'true');
  });

  it('emits no headings, so the loading state never enters the document outline', () => {
    render(ShowContentSkeleton, { props: {} });

    // The old skeleton drew real "Titles / Production / Information" text. A
    // placeholder that reads as content is worse than an empty page.
    expect(screen.queryAllByRole('heading')).toHaveLength(0);
    expect(screen.getByLabelText('Loading show').textContent?.trim()).toBe('');
  });

  describe('the block stack matches what loads', () => {
    it('draws the hero, the quick-info bar, the section nav and the section column', () => {
      const { container } = render(ShowContentSkeleton, { props: {} });

      // One of each, in the order ShowContent renders them.
      expect(container.querySelectorAll('.skeleton-hero')).toHaveLength(1);
      expect(container.querySelectorAll('.skeleton-quick-info')).toHaveLength(1);
      expect(container.querySelectorAll('.skeleton-nav')).toHaveLength(1);
      expect(container.querySelectorAll('.skeleton-main')).toHaveLength(1);

      // classList[0]: svelte appends a scoped-style hash to every class list.
      const blocks = [...container.querySelectorAll('.skeleton-root > div')].map(
        (el) => el.classList[0]
      );
      expect(blocks).toEqual([
        'skeleton-hero',
        'skeleton-quick-info',
        'skeleton-nav',
        'skeleton-main'
      ]);
    });

    it('stands the identity panel in the hero, as ShowHero does', () => {
      const { container } = render(ShowContentSkeleton, { props: {} });

      const hero = container.querySelector('.skeleton-hero') as HTMLElement;
      // Poster beside title-and-qualifiers, then the body band under them --
      // ShowIdentityPanel's two bands.
      expect(hero.querySelector('.skeleton-panel .skeleton-identity')).toBeInTheDocument();
      expect(hero.querySelector('.skeleton-poster')).toBeInTheDocument();
      expect(hero.querySelector('.skeleton-panel .skeleton-panel-body')).toBeInTheDocument();
    });

    it('splits the quick-info bar into the chip row and the tracking controls', () => {
      const { container } = render(ShowContentSkeleton, { props: {} });

      const bar = container.querySelector('.skeleton-quick-info') as HTMLElement;
      // ShowQuickInfo's own split: facts on the left, the viewer's three
      // controls (add, score, stepper) on the right.
      expect(bar.querySelectorAll('.skeleton-chips > *')).toHaveLength(5);
      expect(bar.querySelectorAll('.skeleton-controls > *')).toHaveLength(3);
    });

    it('draws one section per section the page can have, each with a ruled heading', () => {
      const { container } = render(ShowContentSkeleton, { props: {} });

      const sections = container.querySelectorAll('.skeleton-main .skeleton-section');
      // The fullest the real stack ever gets: synopsis, news, episodes,
      // characters. `sectionTabs` is the authority on that, so the skeleton is
      // checked against it rather than against a hardcoded 4.
      const widest = sectionTabs({ newsEnabled: true, newsCount: 3, episodeCount: 26 });
      expect(sections).toHaveLength(widest.length);

      for (const section of sections) {
        // ShowSection renders a heading followed by a hairline out to the
        // column edge; the placeholder has to be the same two elements.
        expect(section.querySelector('.skeleton-heading')).toBeInTheDocument();
        expect(section.querySelector('.skeleton-heading .skeleton-rule')).toBeInTheDocument();
      }
    });

    it('gives each section the body shape that section actually loads', () => {
      const { container } = render(ShowContentSkeleton, { props: {} });

      const sections = [...container.querySelectorAll('.skeleton-main .skeleton-section')];

      // Synopsis is prose: four lines of running text, no rows.
      expect(sections[0].querySelectorAll('.skeleton-stack > *')).toHaveLength(4);
      expect(sections[0].querySelector('.skeleton-row')).toBeNull();

      // News and Episodes are lists of rows.
      expect(sections[1].querySelectorAll('.skeleton-stack .skeleton-row')).toHaveLength(3);
      expect(sections[2].querySelectorAll('.skeleton-stack .skeleton-row')).toHaveLength(3);

      // Characters is a grid of cards.
      expect(sections[3].querySelector('.skeleton-grid')).toBeInTheDocument();
      expect(sections[3].querySelectorAll('.skeleton-grid .skeleton-row')).toHaveLength(6);
      expect(sections[3].querySelector('.skeleton-stack')).toBeNull();
    });

    /**
     * The nav placeholder draws five chips where the fullest real nav has four
     * (Synopsis, News, Episodes, Characters). Cosmetic rather than a jump --
     * the chips are fixed-width placeholders, not measured from the real
     * labels -- but it is the one place the skeleton and the stack disagree.
     * Asserted as-is so a future change to `sectionTabs` surfaces here.
     */
    it('draws the section nav as a single row of chip placeholders', () => {
      const { container } = render(ShowContentSkeleton, { props: {} });

      expect(container.querySelectorAll('.skeleton-nav-inner > *')).toHaveLength(5);
    });
  });

  describe('placeholders', () => {
    it('is built entirely from the Skeleton primitive, with no second shimmer', () => {
      const { container } = render(ShowContentSkeleton, { props: {} });

      // `animate-pulse` is Skeleton's one animation. The old skeleton ran an
      // `animate-shimmer` keyframe with a `via-white/40` sweep that nothing
      // else in the app uses.
      const pulses = container.querySelectorAll('.animate-pulse');
      expect(pulses.length).toBeGreaterThan(30);
      expect(container.querySelectorAll('[class*="shimmer"]')).toHaveLength(0);

      // Every leaf placeholder is one of them: the only other elements are the
      // structural wrappers and the section rule.
      const leaves = [...container.querySelectorAll('div')].filter((el) => el.children.length === 0);
      const notPlaceholders = leaves.filter((el) => !el.classList.contains('animate-pulse'));
      expect(notPlaceholders.map((el) => el.classList[0])).toEqual([
        'skeleton-hero-art',
        'skeleton-hero-scrim'
      ]);
    });

    it('takes no props -- it is the same picture for every show', () => {
      // Nothing to configure means nothing that can be configured wrong; the
      // page renders it before it knows which anime it is loading.
      const { container } = render(ShowContentSkeleton, { props: {} });

      expect(container.querySelector('.skeleton-root')).toBeInTheDocument();
    });
  });
});
