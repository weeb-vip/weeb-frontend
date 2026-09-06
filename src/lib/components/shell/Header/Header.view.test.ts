import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
import { readable } from 'svelte/store';
import { tick } from 'svelte';

/**
 * The nav bar's markup: the six sections, which one is marked current, the two
 * grounds it can be drawn on, and that the chrome it hosts is actually
 * mounted.
 *
 * The easing arithmetic behind `solid` -- how far one wheel tick moves it, how
 * it settles, what reduced motion does -- belongs to `HeaderBloc` and is
 * asserted in `Header.test.ts`. What is asserted here is the half the bloc
 * cannot: that a scroll reaches it only on an overlay page, that the value it
 * produces is published to the stylesheet, and that the bar tears its frame
 * loop down when it unmounts.
 *
 * Header's four chrome children take no bloc, and between them they run a
 * GraphQL user query, fetch /config.json and stand up an Algolia client --
 * none of which belongs in a unit test of the bar. Storybook substitutes them
 * with the stand-ins in `__stories__/offline/` through a Vite alias; the same
 * substitution happens here through `vi.mock`, with markers instead of
 * stand-ins, so "the search sits in the search landmark" is assertable without
 * a network. `TitleLanguageToggle` is left real: it is a button on a
 * localStorage-backed store and nothing else.
 *
 * jsdom caveat: no stylesheet is loaded, so none of this is a claim about
 * appearance. `--nav-solid`, `.nav--overlay` and `.nav--glass` are asserted as
 * the hooks the stylesheet keys on -- whether the bar actually dissolves into
 * the artwork is a browser fact and belongs to the visual/e2e layer.
 */

const { stubComponent } = vi.hoisted(() => ({
  /** A component-shaped marker: Svelte 5 calls a child as `fn(anchor, props)`. */
  stubComponent: (name: string) => (anchor: Node) => {
    const marker = document.createElement('div');
    marker.setAttribute('data-chrome', name);
    (anchor as ChildNode).before(marker);
  }
}));

vi.mock('$lib/components/shell/AutocompleteAdvanced', () => ({
  default: stubComponent('search')
}));
vi.mock('$lib/components/shell/UserProfileHandler', () => ({ default: stubComponent('user') }));
vi.mock('$lib/components/shell/AuthInitializer', () => ({ default: stubComponent('auth') }));
vi.mock('$lib/components/shell/LoginModalHandler', () => ({
  default: stubComponent('login-modal')
}));

import Header from './Header.svelte';
import { HeaderBloc, type FramePort } from './Header.bloc.svelte';

/** A frame port that hands out handles and never runs anything. */
function frames() {
  const request = vi.fn(() => 1);
  const cancel = vi.fn();

  return { port: { request, cancel } satisfies FramePort, request, cancel };
}

function makeBloc(
  options: {
    overlay?: boolean;
    pathname?: string;
    frames?: FramePort;
    reducedMotion?: boolean;
  } = {}
) {
  return new HeaderBloc({
    overlay: options.overlay ?? false,
    route: readable(options.pathname ?? '/'),
    frames: options.frames ?? { request: () => 0, cancel: () => {} },
    // Reduced motion lands `scrolled` on its target in one step, which is what
    // makes a settled value assertable without running a frame loop.
    prefersReducedMotion: () => options.reducedMotion ?? true
  });
}

const bar = () => screen.getByRole('navigation', { name: 'Main' });

/** jsdom never scrolls, so the offset has to be stated outright. */
function scrollTo(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
  window.dispatchEvent(new Event('scroll'));
}

describe('Header', () => {
  afterEach(() => {
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  });

  describe('the sections', () => {
    it('lists the six of them, in order, in the one Main landmark', () => {
      render(Header, { props: { ssrAuth: null, bloc: makeBloc() } });

      const links = within(bar())
        .getAllByRole('link')
        .map((link) => link.textContent?.trim());
      // The logo is the first link in the bar; the sections follow it.
      expect(links).toEqual([
        'weeb.vip',
        'Home',
        'Season',
        'Airing',
        'Browse',
        'Manga',
        'Light novels'
      ]);
    });

    it('points each one at its section, the season link at a season', () => {
      render(Header, { props: { ssrAuth: null, bloc: makeBloc() } });

      expect(screen.getByRole('link', { name: 'Airing' })).toHaveAttribute('href', '/airing');
      expect(screen.getByRole('link', { name: 'Browse' })).toHaveAttribute('href', '/search');
      expect(screen.getByRole('link', { name: 'Manga' })).toHaveAttribute('href', '/manga');
      expect(screen.getByRole('link', { name: 'Light novels' })).toHaveAttribute(
        'href',
        '/light-novels'
      );
      expect(screen.getByRole('link', { name: 'Season' }).getAttribute('href')).toMatch(
        /^\/season\/(WINTER|SPRING|SUMMER|FALL)_\d{4}$/
      );
    });

    it('marks the section you are in, and only that one', () => {
      render(Header, {
        props: { ssrAuth: null, bloc: makeBloc({ pathname: '/manga/spice-and-wolf' }) }
      });

      expect(screen.getByRole('link', { name: 'Manga' })).toHaveAttribute('aria-current', 'page');
      for (const name of ['Home', 'Season', 'Airing', 'Browse', 'Light novels']) {
        expect(screen.getByRole('link', { name })).not.toHaveAttribute('aria-current');
      }
    });

    it('marks Home on the home page', () => {
      render(Header, { props: { ssrAuth: null, bloc: makeBloc({ pathname: '/' }) } });

      expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    });

    it('leaves Home unmarked once you are inside another section', () => {
      render(Header, { props: { ssrAuth: null, bloc: makeBloc({ pathname: '/airing' }) } });

      expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
      expect(screen.getByRole('link', { name: 'Airing' })).toHaveAttribute('aria-current', 'page');
    });
  });

  describe('solid versus overlay', () => {
    /**
     * Every one of the overlay rules is written against `--nav-solid`, so the
     * value the bloc settles on has to reach the element as a custom property.
     * That it is *published* is assertable here; what it looks like is not.
     */
    it('an ordinary page draws a solid bar, at full glass, from the first pixel', () => {
      render(Header, { props: { ssrAuth: null, bloc: makeBloc({ overlay: false }) } });

      const nav = bar();
      expect(nav).not.toHaveClass('nav--overlay');
      expect(nav).toHaveClass('nav--glass');
      expect(nav.getAttribute('style')).toContain('--nav-solid: 1');
    });

    it('an overlay page starts dissolved, with no glass to blur', () => {
      render(Header, {
        props: { ssrAuth: null, overlay: true, bloc: makeBloc({ overlay: true }) }
      });

      const nav = bar();
      expect(nav).toHaveClass('nav--overlay');
      expect(nav).not.toHaveClass('nav--glass');
      expect(nav.getAttribute('style')).toContain('--nav-solid: 0');
    });

    it('scrolling an overlay page brings the glass back', async () => {
      render(Header, {
        props: { ssrAuth: null, overlay: true, bloc: makeBloc({ overlay: true }) }
      });

      scrollTo(400);
      await tick();

      const nav = bar();
      expect(nav.getAttribute('style')).toContain('--nav-solid: 1');
      expect(nav).toHaveClass('nav--glass');
    });

    /**
     * The scroll handler is wired only while the bar is an overlay. A solid bar
     * has glass at every scroll position, so listening would be work done on
     * every scroll event of every ordinary page for no visible change.
     */
    it('does not listen for scroll at all on a solid page', async () => {
      render(Header, {
        props: { ssrAuth: null, overlay: false, bloc: makeBloc({ overlay: false }) }
      });

      // Back at the top of the page. Were the handler wired here, this would
      // drive `solid` to 0 and dissolve the bar on a page with nothing behind it.
      scrollTo(0);
      await tick();

      expect(bar().getAttribute('style')).toContain('--nav-solid: 1');
    });

    /**
     * `overlay` is derived from the route at the call site, so it changes under
     * the component on navigation -- leaving an artwork page has to hand the
     * bar its glass back rather than leaving it dissolved over a white one.
     */
    it('takes its glass back when a navigation says the page no longer has artwork', async () => {
      const bloc = makeBloc({ overlay: true });
      const { rerender } = render(Header, { props: { ssrAuth: null, overlay: true, bloc } });
      expect(bar()).toHaveClass('nav--overlay');

      await rerender({ ssrAuth: null, overlay: false, bloc });

      const nav = bar();
      expect(nav).not.toHaveClass('nav--overlay');
      expect(nav.getAttribute('style')).toContain('--nav-solid: 1');
    });
  });

  describe('the chrome it composes', () => {
    it('puts the search box in a search landmark', () => {
      render(Header, { props: { ssrAuth: null, bloc: makeBloc() } });

      const search = within(bar()).getByRole('search');
      expect(search.querySelector('[data-chrome="search"]')).not.toBeNull();
    });

    it('renders the language toggle beside the account chrome', () => {
      render(Header, { props: { ssrAuth: null, bloc: makeBloc() } });

      expect(
        within(bar()).getByRole('button', { name: 'Show titles in Japanese' })
      ).toBeInTheDocument();
      // Two account slots: the desktop cluster and the mobile one. Which of
      // them is on screen is a media query, which jsdom does not evaluate.
      expect(bar().querySelectorAll('[data-chrome="user"]')).toHaveLength(2);
    });

    it('mounts the auth initializer and the login modal handler outside the bar', () => {
      const { container } = render(Header, { props: { ssrAuth: null, bloc: makeBloc() } });

      expect(container.querySelector('[data-chrome="auth"]')).not.toBeNull();
      expect(container.querySelector('[data-chrome="login-modal"]')).not.toBeNull();
      expect(bar().querySelector('[data-chrome="auth"]')).toBeNull();
    });

    /** `#main-header` is the anchor the page offsets and the e2e suite scrolls to. */
    it('keeps the id the rest of the app addresses it by', () => {
      render(Header, { props: { ssrAuth: null, bloc: makeBloc() } });

      expect(bar()).toHaveAttribute('id', 'main-header');
    });
  });

  it('stops the frame loop when the bar goes away', () => {
    const { port, request, cancel } = frames();
    const bloc = makeBloc({ overlay: true, frames: port, reducedMotion: false });
    const { unmount } = render(Header, { props: { ssrAuth: null, overlay: true, bloc } });

    scrollTo(200);
    expect(request).toHaveBeenCalled();

    unmount();

    expect(cancel).toHaveBeenCalledWith(1);
  });
});
