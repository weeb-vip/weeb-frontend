import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { stubNeverLoadingImages, stubScrollIntoView } from '$lib/components/__tests__/jsdom-gaps';
import AutocompleteAdvanced from './AutocompleteAdvanced.svelte';
import {
  AutocompleteAdvancedBloc,
  type SearchCollection,
  type SearchHit,
  type SearchPort,
  type SearchState
} from './AutocompleteAdvanced.bloc.svelte';

/**
 * The header search as it is drawn: the combobox contract, the grouped panel,
 * the highlight the arrow keys move, and the two degraded states.
 *
 * What a query returns, how the groups are ordered and where a chosen hit
 * sends you are the bloc's, and are asserted in `AutocompleteAdvanced.test.ts`.
 * This file drives the real bloc through a stubbed `SearchPort` -- Algolia is
 * never reached, never imported and never asked for a key -- and asserts the
 * DOM and the ARIA that come out of it.
 *
 * Three stand-ins, all for things the platform (not the app) is missing:
 *
 *  - `motion` is mocked. Its `animate()` reaches for the Web Animations API,
 *    which jsdom does not implement, and falls back to a JS driver that throws
 *    on the three-keyframe spring the focus animation uses. Every animation
 *    here is decoration over state that is asserted directly; whether the panel
 *    actually springs open is a browser fact and belongs to the visual layer.
 *  - `stubScrollIntoView`, because the component keeps the highlighted option in
 *    view on every arrow key and jsdom implements no scrolling at all.
 *  - `stubNeverLoadingImages`, so each row's `SafeImage` settles instead of
 *    hanging on a probe that jsdom will never resolve.
 *
 * Both the mobile and the desktop shell are always in the DOM -- which of them
 * is on screen is a media query, and jsdom evaluates none -- so every query
 * below is scoped to one of the two by its listbox id. Those ids, the
 * `ac-opt-{device}-{i}` option ids and `.ac-input--desktop` are asserted as
 * literal strings on purpose: they are the selectors `tests/e2e` drives the
 * search with, so they are a contract rather than an implementation detail.
 */

vi.mock('motion', () => ({
  animate: () => Promise.resolve(),
  stagger: () => 0
}));

const anime = (id: string, title: string): SearchHit => ({
  objectID: id,
  id,
  title_en: title,
  url_slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  start_date: '2008-01-09T00:00:00Z'
});

const work = (id: string, title: string): SearchHit => ({
  objectID: id,
  id,
  __kind: 'work',
  type: 'LIGHT_NOVEL',
  title_en: title,
  url_slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
});

const group = (sourceId: string, items: SearchHit[]): SearchCollection => ({
  source: { sourceId },
  items
});

/** A search backend in memory: the test decides what every keystroke answers. */
function searchPort(initial: Partial<SearchState> = {}) {
  let state: SearchState = { query: '', isOpen: false, collections: [], ...initial };
  let push: ((next: SearchState) => void) | null = null;
  const emit = () => push?.({ ...state });

  const session = {
    setQuery: vi.fn((query: string) => {
      state = { ...state, query };
      emit();
    }),
    refresh: vi.fn(),
    setIsOpen: vi.fn((isOpen: boolean) => {
      state = { ...state, isOpen };
      emit();
    })
  };

  const port: SearchPort = {
    async connect(onState) {
      push = onState;
      emit();

      return session;
    }
  };

  return { port, session };
}

/** Algolia could not be reached at all. */
const unavailable: SearchPort = { connect: async () => null };
/** Still connecting: the component sits on its skeleton. */
const neverConnects: SearchPort = { connect: () => new Promise(() => {}) };

function mount(
  options: {
    search?: SearchPort;
    state?: Partial<SearchState>;
    navigate?: (url: string) => void;
    /**
     * The real delay exists so a blur cannot close the panel before the click
     * that caused it lands on a result -- so any test that clicks a row keeps
     * it, and every other test sets 0 rather than racing a timer.
     */
    dismissDelayMs?: number;
  } = {}
) {
  const navigate = options.navigate ?? vi.fn();
  const searchPerformed = vi.fn();
  const bloc = new AutocompleteAdvancedBloc({
    search: options.search ?? searchPort(options.state).port,
    navigate,
    analytics: { searchPerformed },
    dismissDelayMs: options.dismissDelayMs ?? 0
  });

  const rendered = render(AutocompleteAdvanced, { props: { bloc } });

  return { ...rendered, bloc, navigate, searchPerformed };
}

/** The desktop field -- `.ac-input--desktop` is the e2e suite's own handle. */
const desktopInput = () =>
  document.querySelector<HTMLInputElement>('.ac-input--desktop') as HTMLInputElement;

const listbox = (device: 'mobile' | 'desktop') => document.getElementById(`ac-listbox-${device}`);

/**
 * Focus the desktop field. `init()` connects to the search port asynchronously,
 * so the fields do not exist on the first tick after `render` -- the wait is
 * for the component to be past its skeleton, not for anything to settle.
 */
async function focusDesktop() {
  await screen.findAllByRole('combobox');
  await userEvent.click(desktopInput());
}

const RESULTS = {
  query: 'spice',
  isOpen: true,
  collections: [group('data', [anime('1', 'Spice and Wolf'), anime('2', 'Spice and Wolf II')])]
};

const GROUPED = {
  query: 'spice',
  isOpen: true,
  collections: [
    group('data', [anime('1', 'Spice and Wolf')]),
    group('works', [work('w1', 'Spice and Wolf Novel')])
  ]
};

describe('AutocompleteAdvanced', () => {
  let restoreScroll: () => void;
  let restoreImages: () => void;
  beforeAll(() => {
    restoreScroll = stubScrollIntoView();
    restoreImages = stubNeverLoadingImages();
  });
  afterAll(() => {
    restoreScroll();
    restoreImages();
  });

  describe('before the search backend answers', () => {
    it('draws a skeleton rather than a dead search box', async () => {
      const { container } = mount({ search: neverConnects });

      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(container.querySelector('.ac-skeleton-pill')).not.toBeNull();
    });
  });

  describe('when search is unavailable', () => {
    /**
     * Algolia failed to load. The field degrades to a plain input that still
     * runs a full search -- not a combobox promising suggestions it cannot
     * make, and not a disabled box.
     */
    it('falls back to a plain input with no combobox semantics', async () => {
      mount({ search: unavailable });

      const input = await screen.findByPlaceholderText('Search anime...');
      expect(input).not.toHaveAttribute('role', 'combobox');
      expect(input).not.toHaveAttribute('aria-controls');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('still runs a full search on Enter', async () => {
      const { navigate } = mount({ search: unavailable });

      const input = await screen.findByPlaceholderText('Search anime...');
      await userEvent.type(input, 'spice and wolf{Enter}');

      expect(navigate).toHaveBeenCalledWith('/search?query=spice%20and%20wolf');
    });

    it('ignores an Enter on an empty box', async () => {
      const { navigate } = mount({ search: unavailable });

      const input = await screen.findByPlaceholderText('Search anime...');
      await userEvent.type(input, '   {Enter}');

      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('the combobox contract', () => {
    it('is a labelled combobox in each shell, each pointing at its own listbox', async () => {
      mount();

      const boxes = await screen.findAllByRole('combobox');
      expect(boxes).toHaveLength(2);

      for (const box of boxes) {
        expect(box).toHaveAccessibleName('Search anime');
        expect(box).toHaveAttribute('aria-autocomplete', 'list');
        expect(box).toHaveAttribute('aria-expanded', 'false');
      }

      // The e2e suite addresses the desktop field by this class and the panel
      // by these ids; they are load-bearing, not incidental.
      expect(desktopInput()).toHaveAttribute('aria-controls', 'ac-listbox-desktop');
      expect(boxes[0]).toHaveAttribute('aria-controls', 'ac-listbox-mobile');
    });

    it('claims nothing expanded and shows no listbox at rest', async () => {
      mount();

      await screen.findAllByRole('combobox');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(desktopInput()).not.toHaveAttribute('aria-activedescendant');
    });

    it('offers the "/" hint until the field is focused', async () => {
      mount({ state: RESULTS });

      await screen.findAllByRole('combobox');
      expect(screen.getAllByText('/')).toHaveLength(2);

      await focusDesktop();

      await waitFor(() => expect(screen.queryAllByText('/')).toHaveLength(0));
    });

    it('opens the listbox on focus and says so on the input', async () => {
      mount({ state: RESULTS });

      await focusDesktop();

      await waitFor(() => expect(listbox('desktop')).not.toBeNull());
      const panel = listbox('desktop') as HTMLElement;
      expect(panel).toHaveAttribute('role', 'listbox');
      expect(panel).toHaveAccessibleName('Search results');
      expect(desktopInput()).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('the results panel', () => {
    it('renders one option per hit, each with the id the highlight points at', async () => {
      mount({ state: RESULTS });

      await focusDesktop();
      await waitFor(() => expect(listbox('desktop')).not.toBeNull());

      const options = within(listbox('desktop') as HTMLElement).getAllByRole('option');
      expect(options.map((option) => option.id)).toEqual(['ac-opt-desktop-0', 'ac-opt-desktop-1']);
      expect(options[0]).toHaveTextContent('Spice and Wolf');
      expect(options.every((option) => option.getAttribute('aria-selected') === 'false')).toBe(
        true
      );
    });

    /**
     * The two shells render the same rows under different ids, so the mobile
     * panel's options are addressable in their own right rather than being a
     * second copy of the desktop ids.
     */
    it('gives the mobile panel its own listbox and option ids', async () => {
      mount({ state: RESULTS });

      await focusDesktop();
      await waitFor(() => expect(listbox('mobile')).not.toBeNull());

      const options = within(listbox('mobile') as HTMLElement).getAllByRole('option');
      expect(options.map((option) => option.id)).toEqual(['ac-opt-mobile-0', 'ac-opt-mobile-1']);
    });

    /**
     * Two indices rank independently, so blending them would mean inventing an
     * order. They stay grouped -- and the headings only appear once there is
     * more than one group, so an anime-only query looks as it always did.
     */
    it('heads each group when more than one index answered', async () => {
      mount({ state: GROUPED });

      await focusDesktop();
      await waitFor(() => expect(listbox('desktop')).not.toBeNull());

      const panel = listbox('desktop') as HTMLElement;
      expect(within(panel).getByText('Anime')).toBeInTheDocument();
      expect(within(panel).getByText('Manga & light novels')).toBeInTheDocument();
    });

    it('draws no headings at all when only one index answered', async () => {
      mount({ state: RESULTS });

      await focusDesktop();
      await waitFor(() => expect(listbox('desktop')).not.toBeNull());

      expect(within(listbox('desktop') as HTMLElement).queryByText('Anime')).not.toBeInTheDocument();
    });

    it('numbers the options flat across the groups, so the highlight runs through both', async () => {
      mount({ state: GROUPED });

      await focusDesktop();
      await waitFor(() => expect(listbox('desktop')).not.toBeNull());

      const options = within(listbox('desktop') as HTMLElement).getAllByRole('option');
      expect(options.map((option) => option.id)).toEqual(['ac-opt-desktop-0', 'ac-opt-desktop-1']);
      expect(options[1]).toHaveTextContent('Spice and Wolf Novel');
    });

    it('offers a way out to the full search results', async () => {
      mount({ state: RESULTS });

      await focusDesktop();

      const footers = await screen.findAllByRole('link', { name: "Search for 'spice'" });
      expect(footers[0]).toHaveAttribute('href', '/search?query=spice');
    });

    it('takes over that link rather than letting the browser follow it', async () => {
      const { navigate } = mount({ state: RESULTS, dismissDelayMs: 200 });

      await focusDesktop();
      const footers = await screen.findAllByRole('link', { name: "Search for 'spice'" });
      await userEvent.click(footers[footers.length - 1]);

      expect(navigate).toHaveBeenCalledWith('/search?query=spice');
    });
  });

  describe('a query that matched nothing', () => {
    it('says so, and offers the full search instead of an empty list', async () => {
      mount({ state: { query: 'qqqqzzzz', isOpen: true, collections: [] } });

      await focusDesktop();

      await waitFor(() =>
        expect(screen.getAllByText("No results for 'qqqqzzzz'").length).toBeGreaterThan(0)
      );
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(
        screen.getAllByRole('link', { name: "Search for 'qqqqzzzz'" }).length
      ).toBeGreaterThan(0);
    });

    /**
     * `aria-expanded` describes the listbox, and there is no listbox to
     * describe here -- the empty state is a message, not a set of options.
     */
    it('does not claim an expanded listbox it is not drawing', async () => {
      mount({ state: { query: 'qqqqzzzz', isOpen: true, collections: [] } });

      await focusDesktop();

      await waitFor(() =>
        expect(screen.getAllByText("No results for 'qqqqzzzz'").length).toBeGreaterThan(0)
      );
      expect(desktopInput()).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('the keyboard', () => {
    it('walks the highlight down the panel, one option at a time', async () => {
      mount({ state: RESULTS });

      await focusDesktop();
      await waitFor(() => expect(listbox('desktop')).not.toBeNull());

      await userEvent.keyboard('{ArrowDown}');
      await waitFor(() =>
        expect(desktopInput()).toHaveAttribute('aria-activedescendant', 'ac-opt-desktop-0')
      );
      expect(document.getElementById('ac-opt-desktop-0')).toHaveAttribute('aria-selected', 'true');
      expect(document.getElementById('ac-opt-desktop-1')).toHaveAttribute('aria-selected', 'false');

      await userEvent.keyboard('{ArrowDown}');
      await waitFor(() =>
        expect(desktopInput()).toHaveAttribute('aria-activedescendant', 'ac-opt-desktop-1')
      );
      expect(document.getElementById('ac-opt-desktop-1')).toHaveAttribute('aria-selected', 'true');
    });

    it('wraps to the last option when arrowing up from the top', async () => {
      mount({ state: RESULTS });

      await focusDesktop();
      await waitFor(() => expect(listbox('desktop')).not.toBeNull());

      await userEvent.keyboard('{ArrowUp}');

      await waitFor(() =>
        expect(desktopInput()).toHaveAttribute('aria-activedescendant', 'ac-opt-desktop-1')
      );
    });

    it('opens the highlighted result on Enter', async () => {
      const { navigate } = mount({ state: RESULTS });

      await focusDesktop();
      await waitFor(() => expect(listbox('desktop')).not.toBeNull());
      await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');

      expect(navigate).toHaveBeenCalledWith('/anime/spice-and-wolf-ii');
    });

    it('falls through to the full search when nothing is highlighted', async () => {
      const { navigate, searchPerformed } = mount({ state: RESULTS });

      await focusDesktop();
      await waitFor(() => expect(listbox('desktop')).not.toBeNull());
      await userEvent.keyboard('{Enter}');

      expect(navigate).toHaveBeenCalledWith('/search?query=spice');
      expect(searchPerformed).toHaveBeenCalledWith('spice', 2);
    });

    it('dismisses the panel on Escape', async () => {
      mount({ state: RESULTS });

      await focusDesktop();
      await waitFor(() => expect(listbox('desktop')).not.toBeNull());

      await userEvent.keyboard('{Escape}');

      await waitFor(() => expect(listbox('desktop')).toBeNull());
      expect(desktopInput()).toHaveAttribute('aria-expanded', 'false');
      expect(desktopInput()).not.toHaveAttribute('aria-activedescendant');
    });

    /** A key the component does not own must not be swallowed on its way to the field. */
    it('leaves ordinary typing to the input', async () => {
      const { bloc } = mount({ state: RESULTS });

      await focusDesktop();
      await userEvent.type(desktopInput(), 'wolf');

      expect(desktopInput()).toHaveValue('wolf');
      expect(bloc.query).toBe('wolf');
    });
  });

  describe('choosing a result with the pointer', () => {
    it('navigates to the row that was clicked and empties the field', async () => {
      const { navigate } = mount({ state: RESULTS, dismissDelayMs: 200 });

      await focusDesktop();
      await userEvent.type(desktopInput(), 'spice');
      await waitFor(() => expect(listbox('desktop')).not.toBeNull());

      const options = within(listbox('desktop') as HTMLElement).getAllByRole('option');
      await userEvent.click(options[0]);

      expect(navigate).toHaveBeenCalledWith('/anime/spice-and-wolf');
      await waitFor(() => expect(desktopInput()).toHaveValue(''));
    });

    it('links a work to its own route, not an anime one', async () => {
      const { navigate } = mount({ state: GROUPED, dismissDelayMs: 200 });

      await focusDesktop();
      await waitFor(() => expect(listbox('desktop')).not.toBeNull());

      const options = within(listbox('desktop') as HTMLElement).getAllByRole('option');
      await userEvent.click(options[1]);

      expect(navigate).toHaveBeenCalledWith('/manga/spice-and-wolf-novel');
    });
  });

  describe('the desktop backdrop', () => {
    /**
     * Built by hand at <body> level rather than declared in the markup, because
     * the header clips it. It is presentational -- Escape and the close paths
     * are what actually dismiss the panel -- so it is asserted as a node that
     * arrives and leaves, not as a control.
     */
    it('is put up while the desktop field has focus and taken down again', async () => {
      mount({ state: RESULTS });

      await focusDesktop();
      await waitFor(() =>
        expect(document.getElementById('desktop-search-backdrop')).not.toBeNull()
      );
      expect(document.getElementById('desktop-search-backdrop')).toHaveAttribute(
        'role',
        'presentation'
      );

      await userEvent.keyboard('{Escape}');

      await waitFor(() => expect(document.getElementById('desktop-search-backdrop')).toBeNull());
    });
  });
});
