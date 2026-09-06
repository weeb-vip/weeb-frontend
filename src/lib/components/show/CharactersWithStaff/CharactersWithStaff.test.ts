import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { QueryClient } from '@tanstack/svelte-query';
import { reactiveScope } from '../../__tests__/reactive-scope.svelte';
import { stubNeverLoadingImages } from '../../__tests__/jsdom-gaps';
import CharactersWithStaff from './CharactersWithStaff.svelte';
import {
  CHARACTER_FILTERS,
  CharactersWithStaffBloc,
  matchesFilter,
  type CharacterEntry,
  type CharactersWithStaffDeps
} from './CharactersWithStaff.bloc.svelte';

const character = (name: string, role: string | null, staffCount = 1): CharacterEntry => ({
  character: { id: name, name, role },
  staff: Array.from({ length: staffCount }, (_, i) => ({
    id: `${name}-${i}`,
    givenName: `VA${i}`,
    familyName: name
  }))
});

const CAST = [
  character('Zoe', 'Supporting'),
  character('Adam', 'Main'),
  character('Nia', 'Main'),
  character('Bob', 'Background')
];

function makeBloc(deps: Partial<CharactersWithStaffDeps> = {}, ssr: CharacterEntry[] | null = CAST) {
  return new CharactersWithStaffBloc({
    source: () => ({
      animeId: 'a1',
      ssrCharactersData: ssr ? { charactersAndStaffByAnimeId: ssr } : null
    }),
    characters: () => ({ queryKey: ['cast', 'a1'], queryFn: async () => [] }),
    queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    ...deps
  });
}

const names = (entries: CharacterEntry[]) => entries.map((e) => e.character.name);

const scopes: (() => void)[] = [];
afterEach(() => {
  while (scopes.length) scopes.pop()!();
});

describe('matchesFilter', () => {
  it('lets everything through under "all"', () => {
    for (const role of ['Main', 'Supporting', 'Background', null]) {
      expect(matchesFilter(role, 'all')).toBe(true);
    }
  });

  it('counts a protagonist as main', () => {
    expect(matchesFilter('Main', 'main')).toBe(true);
    expect(matchesFilter('Protagonist', 'main')).toBe(true);
    expect(matchesFilter('Supporting', 'main')).toBe(false);
  });

  it('reads whatever case the role arrived in', () => {
    expect(matchesFilter('MAIN CHARACTER', 'main')).toBe(true);
    expect(matchesFilter('supporting cast', 'supporting')).toBe(true);
  });

  it('treats anything that is neither as minor, including no role at all', () => {
    expect(matchesFilter('Background', 'minor')).toBe(true);
    expect(matchesFilter(null, 'minor')).toBe(true);
    expect(matchesFilter('Main', 'minor')).toBe(false);
    expect(matchesFilter('Supporting', 'minor')).toBe(false);
  });

  it('never puts one role in two buckets', () => {
    for (const role of ['Main', 'Protagonist', 'Supporting', 'Background', null]) {
      const buckets = (['main', 'supporting', 'minor'] as const).filter((f) =>
        matchesFilter(role, f)
      );

      expect(buckets).toHaveLength(1);
    }
  });
});

describe('CharactersWithStaffBloc', () => {
  describe('where the cast comes from', () => {
    it('renders what the page loader already had, and never fetches', async () => {
      const queryFn = vi.fn(async () => []);
      const bloc = makeBloc({ characters: () => ({ queryKey: ['cast'], queryFn }) });
      scopes.push(reactiveScope(() => bloc.entries, () => bloc.isLoading));

      expect(bloc.entries).toEqual(CAST);
      expect(bloc.isLoading).toBe(false);
      expect(bloc.isError).toBe(false);
      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(queryFn).not.toHaveBeenCalled();
    });

    it('runs its own query when the page had none', async () => {
      const queryFn = vi.fn(async () => CAST);
      const bloc = makeBloc({ characters: () => ({ queryKey: ['cast'], queryFn }) }, null);
      scopes.push(reactiveScope(() => bloc.entries, () => bloc.isLoading));

      await vi.waitFor(() => expect(bloc.entries).toEqual(CAST));
      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it('is loading, not empty, before that query answers', () => {
      const bloc = makeBloc(
        { characters: () => ({ queryKey: ['cast'], queryFn: () => new Promise(() => {}) }) },
        null
      );

      expect(bloc.isLoading).toBe(true);
      expect(bloc.entries).toEqual([]);
    });

    it('reports a failed fetch and its cause', async () => {
      const bloc = makeBloc(
        {
          characters: () => ({
            queryKey: ['cast'],
            queryFn: async () => Promise.reject(new Error('upstream 500'))
          })
        },
        null
      );
      scopes.push(reactiveScope(() => bloc.isError, () => bloc.entries));

      await vi.waitFor(() => expect(bloc.isError).toBe(true));
      expect(bloc.errorDetail).toBe('upstream 500');
    });

    it('has no second line for a failure that carried no message', async () => {
      const bloc = makeBloc(
        { characters: () => ({ queryKey: ['cast'], queryFn: async () => Promise.reject({}) }) },
        null
      );
      scopes.push(reactiveScope(() => bloc.isError));

      await vi.waitFor(() => expect(bloc.isError).toBe(true));
      expect(bloc.errorDetail).toBe('');
    });

    it('reads an SSR payload with an empty cast as empty, not loading', () => {
      const bloc = makeBloc({}, []);

      expect(bloc.isEmpty).toBe(true);
      expect(bloc.isLoading).toBe(false);
    });
  });

  describe('the order', () => {
    it('puts leads first, then supporting, then everyone else', () => {
      expect(names(makeBloc().visible)).toEqual(['Adam', 'Nia', 'Zoe', 'Bob']);
    });

    it('breaks ties by name', () => {
      const bloc = makeBloc({}, [character('Nia', 'Main'), character('Adam', 'Main')]);

      expect(names(bloc.visible)).toEqual(['Adam', 'Nia']);
    });

    it('sorts before filtering, so the cards that stay do not reshuffle', () => {
      const bloc = makeBloc();
      const leadsInAll = names(bloc.visible).filter((n) => n === 'Adam' || n === 'Nia');

      bloc.selectFilter('main');

      expect(names(bloc.visible)).toEqual(leadsInAll);
    });

    it('does not reorder the source array in place', () => {
      const cast = [character('Zoe', 'Supporting'), character('Adam', 'Main')];
      makeBloc({}, cast).visible;

      expect(names(cast)).toEqual(['Zoe', 'Adam']);
    });
  });

  describe('the filter', () => {
    it('starts on all, and offers the four buckets', () => {
      const bloc = makeBloc();

      expect(bloc.filter).toBe('all');
      expect(bloc.filters).toBe(CHARACTER_FILTERS);
      expect(CHARACTER_FILTERS.map((f) => f.value)).toEqual([
        'all',
        'main',
        'supporting',
        'minor'
      ]);
    });

    it('narrows the cards to the chosen bucket', () => {
      const bloc = makeBloc();

      bloc.selectFilter('main');
      expect(names(bloc.visible)).toEqual(['Adam', 'Nia']);

      bloc.selectFilter('supporting');
      expect(names(bloc.visible)).toEqual(['Zoe']);

      bloc.selectFilter('minor');
      expect(names(bloc.visible)).toEqual(['Bob']);
    });

    it('tells "no cast at all" apart from "none in this filter"', () => {
      const bloc = makeBloc({}, [character('Adam', 'Main')]);

      bloc.selectFilter('minor');

      expect(bloc.isEmpty).toBe(false);
      expect(bloc.isFilteredOut).toBe(true);
    });

    it('is not "filtered out" when there was never a cast', () => {
      const bloc = makeBloc({}, []);

      expect(bloc.isEmpty).toBe(true);
      expect(bloc.isFilteredOut).toBe(false);
    });
  });

  describe('the cards', () => {
    it('opens and closes a card with several voice actors', () => {
      const many = character('Adam', 'Main', 3);
      const bloc = makeBloc({}, [many]);

      expect(bloc.isExpanded(many)).toBe(false);
      bloc.toggleExpanded(many);
      expect(bloc.isExpanded(many)).toBe(true);

      bloc.toggleExpanded(many);
      expect(bloc.isExpanded(many)).toBe(false);
    });

    it('will not open a card with one voice actor -- it has nothing to show', () => {
      const one = character('Adam', 'Main', 1);
      const bloc = makeBloc({}, [one]);

      expect(bloc.hasMultipleVoiceActors(one)).toBe(false);
      bloc.toggleExpanded(one);
      expect(bloc.isExpanded(one)).toBe(false);
    });

    it('will not open a card with no cast credited at all', () => {
      const none: CharacterEntry = { character: { name: 'Adam', role: 'Main' }, staff: null };
      const bloc = makeBloc({}, [none]);

      expect(bloc.hasMultipleVoiceActors(none)).toBe(false);
      expect(bloc.primaryVoiceActor(none)).toBeUndefined();
    });

    it('shows the first credited voice actor on the face of the card', () => {
      const many = character('Adam', 'Main', 3);

      expect(makeBloc({}, [many]).primaryVoiceActor(many)?.id).toBe('Adam-0');
    });

    it('marks only a lead as a lead', () => {
      const bloc = makeBloc();

      expect(bloc.isLeadRole(character('Adam', 'Main'))).toBe(true);
      expect(bloc.isLeadRole(character('Zoe', 'Supporting'))).toBe(false);
    });
  });
});

/**
 * The cast grid.
 *
 * Ordering, filtering and which cards are expandable are the bloc's and are
 * asserted above; this half is what a reader sees -- the four states, the cards
 * themselves, the filter strip, and the one control on a card with more than one
 * voice actor.
 *
 * The bloc is the real one, constructed with a fake `characters` port, and it is
 * the component's render that subscribes to its query store: `fromStore` checks
 * for a tracking context at READ time, and a mounted view reading `bloc.isLoading`
 * in its template is exactly that subscriber. So no `reactiveScope` here -- the
 * render is the scope, and the query genuinely moves from pending to settled
 * under `findBy*`/`waitFor` below.
 *
 * jsdom caveats: portraits go through `SafeImage`, whose `new Image()` probe
 * never settles here, so every card is asserted in its no-artwork state
 * (`stubNeverLoadingImages`); and no stylesheet is loaded, so the lead-role
 * accent and the chevron's rotation are only assertable as the classes the
 * stylesheet keys on.
 */
describe('CharactersWithStaff', () => {
  let restoreImages: () => void;
  beforeEach(() => {
    restoreImages = stubNeverLoadingImages();
  });
  afterEach(() => restoreImages());

  const NEVER = () => new Promise<CharacterEntry[]>(() => {});

  /** Mounts the grid over a bloc whose cast is already in hand (the SSR path). */
  function renderCast(cast: CharacterEntry[] | null = CAST) {
    const bloc = makeBloc({}, cast);
    return { ...render(CharactersWithStaff, { props: { animeId: 'a1', bloc } }), bloc };
  }

  /** Mounts the grid over a bloc that has to fetch. */
  function renderFetching(queryFn: () => Promise<CharacterEntry[]>) {
    const bloc = makeBloc({ characters: () => ({ queryKey: ['cast', 'a1'], queryFn }) }, null);
    return { ...render(CharactersWithStaff, { props: { animeId: 'a1', bloc } }), bloc };
  }

  const card = (name: string) =>
    screen.getByText(name).closest('.char-card') as HTMLElement;

  describe('while the cast is loading', () => {
    it('shows a spinner rather than an empty grid or a "no cast" claim', () => {
      const { container } = renderFetching(NEVER);

      expect(container.querySelector('.chars-spinner')).toBeInTheDocument();
      expect(screen.queryByText('No character data available.')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('group', { name: 'Filter characters by role' })
      ).not.toBeInTheDocument();
    });
  });

  describe('when the cast is here', () => {
    it('draws a card per character, ordered by importance then name', () => {
      const { container } = renderCast();

      const drawn = Array.from(container.querySelectorAll('.char-name')).map(
        (node) => node.textContent
      );
      expect(drawn).toEqual(['Adam', 'Nia', 'Zoe', 'Bob']);
    });

    it('names the character, their role and the voice actor behind them', () => {
      renderCast();

      const adam = card('Adam');
      expect(within(adam).getByText('Main')).toBeInTheDocument();
      expect(within(adam).getByText(/VA0 Adam/)).toBeInTheDocument();
    });

    it('marks a lead role so it reads differently from the rest of the cast', () => {
      renderCast();

      expect(card('Adam').querySelector('.char-role')).toHaveClass('main');
      expect(card('Zoe').querySelector('.char-role')).not.toHaveClass('main');
    });

    it('says "Character" rather than nothing for an entry with no role', () => {
      renderCast([{ character: { id: 'x', name: 'Nameless', role: null }, staff: [] }]);

      expect(card('Nameless').querySelector('.char-role')).toHaveTextContent('Character');
    });

    it('says "Unknown" rather than an empty card for a character with no name', () => {
      const { container } = renderCast([{ character: { id: 'x', name: null }, staff: [] }]);

      expect(container.querySelector('.char-name')).toHaveTextContent('Unknown');
    });

    /**
     * A card with one voice actor is not expandable, so the name is free to be a
     * link. On a card that IS expandable the card is itself a `<button>`, and an
     * `<a>` inside a button is invalid and unreachable by keyboard -- so those
     * link from the expanded list instead.
     */
    it('links the sole voice actor’s name straight to their page', () => {
      renderCast();

      const link = within(card('Adam')).getByRole('link', { name: /VA0 Adam/ });
      expect(link).toHaveAttribute('href', '/people/Adam-0');
    });

    it('does not nest a link inside the expandable card', () => {
      renderCast([character('Nia', 'Main', 3)]);

      const nia = card('Nia');
      expect(nia.querySelector('button a')).not.toBeInTheDocument();
      expect(within(nia).queryByRole('link')).not.toBeInTheDocument();
    });
  });

  describe('when there is no cast at all', () => {
    it('says so once, and offers no filter strip to narrow nothing with', () => {
      renderCast([]);

      expect(screen.getByText('No character data available.')).toBeInTheDocument();
      expect(
        screen.queryByRole('group', { name: 'Filter characters by role' })
      ).not.toBeInTheDocument();
    });
  });

  describe('when the fetch fails', () => {
    /** A failed fetch is not an empty cast: the show may well have one. */
    it('says what happened and names the cause, instead of claiming there is no cast', async () => {
      renderFetching(async () => Promise.reject(new Error('upstream 500')));

      expect(await screen.findByText("Couldn't load the cast.")).toBeInTheDocument();
      expect(screen.getByText('upstream 500')).toBeInTheDocument();
      expect(screen.queryByText('No character data available.')).not.toBeInTheDocument();
    });

    it('offers a retry that fetches the cast again', async () => {
      const queryFn = vi.fn(async () => Promise.reject(new Error('upstream 500')));
      renderFetching(queryFn);
      await screen.findByText("Couldn't load the cast.");
      expect(queryFn).toHaveBeenCalledTimes(1);

      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

      await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
    });
  });

  describe('the filter strip', () => {
    it('offers every bucket, opening on "All"', () => {
      renderCast();

      const strip = screen.getByRole('group', { name: 'Filter characters by role' });
      expect(
        within(strip).getAllByRole('button').map((chip) => chip.textContent?.trim())
      ).toEqual(['All', 'Main', 'Supporting', 'Minor']);
      expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('narrows the grid to the chosen bucket', async () => {
      const { container } = renderCast();

      await userEvent.click(screen.getByRole('button', { name: 'Main' }));

      await waitFor(() => {
        expect(
          Array.from(container.querySelectorAll('.char-name')).map((node) => node.textContent)
        ).toEqual(['Adam', 'Nia']);
      });
      expect(screen.getByRole('button', { name: 'Main' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('puts everything back when "All" is chosen again', async () => {
      const { container } = renderCast();
      await userEvent.click(screen.getByRole('button', { name: 'Minor' }));
      await waitFor(() => expect(container.querySelectorAll('.char-name')).toHaveLength(1));

      await userEvent.click(screen.getByRole('button', { name: 'All' }));

      await waitFor(() => expect(container.querySelectorAll('.char-name')).toHaveLength(4));
    });

    it('says the filter is empty -- not that the show has no cast -- and offers the way back', async () => {
      const { container } = renderCast([character('Zoe', 'Supporting')]);

      await userEvent.click(screen.getByRole('button', { name: 'Main' }));

      expect(await screen.findByText('No characters found for this filter.')).toBeInTheDocument();
      // The strip stays: this is a narrowing, not an absence.
      expect(screen.getByRole('group', { name: 'Filter characters by role' })).toBeInTheDocument();
      expect(container.querySelectorAll('.char-name')).toHaveLength(0);
    });

    it('undoes the filter from the empty state’s own control', async () => {
      const { container } = renderCast([character('Zoe', 'Supporting')]);
      await userEvent.click(screen.getByRole('button', { name: 'Main' }));
      await screen.findByText('No characters found for this filter.');

      await userEvent.click(screen.getByRole('button', { name: 'Show all' }));

      await waitFor(() => expect(container.querySelectorAll('.char-name')).toHaveLength(1));
      expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    });

    /**
     * The strip used to render `ChipGroup`'s `mode="tabs"` default -- a real
     * `role="tablist"` of `role="tab"`s -- with no `role="tabpanel"` here or
     * anywhere in the app. Assistive tech was told it had moved to a tab and
     * then told nothing about what appeared.
     *
     * Of the two honest fixes -- own a tabpanel, or stop claiming tabs -- this
     * is the second, because the control does not behave like tabs: it narrows
     * ONE grid in place rather than swapping between panels, and its buckets
     * overlap ("All" contains the other three). It is a filter, so it is a
     * group of pressed buttons.
     */
    it('should either own a tabpanel or not claim to be tabs at all', () => {
      renderCast();

      // Nothing claims to be tabs, so nothing has to own a panel.
      expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
      expect(screen.queryAllByRole('tab')).toHaveLength(0);
      expect(screen.queryAllByRole('tabpanel')).toHaveLength(0);

      // What it is instead: a named group of buttons, exactly one pressed.
      const strip = screen.getByRole('group', { name: 'Filter characters by role' });
      const chips = within(strip).getAllByRole('button');
      expect(chips.filter((chip) => chip.getAttribute('aria-pressed') === 'true')).toHaveLength(1);
      for (const chip of chips) {
        expect(chip).toHaveAttribute('aria-pressed');
        expect(chip).not.toHaveAttribute('aria-controls');
      }
    });

    it('leaves every chip its own tab stop -- a filter row is not a roving tablist', () => {
      renderCast();

      const strip = screen.getByRole('group', { name: 'Filter characters by role' });
      for (const chip of within(strip).getAllByRole('button')) {
        expect(chip).not.toHaveAttribute('tabindex');
      }
    });

    it('moves the pressed marker with the selection, leaving only one on', async () => {
      renderCast();

      await userEvent.click(screen.getByRole('button', { name: 'Supporting' }));

      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Supporting' })).toHaveAttribute(
          'aria-pressed',
          'true'
        )
      );
      for (const name of ['All', 'Main', 'Minor']) {
        expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'false');
      }
    });
  });

  describe('a character with more than one voice actor', () => {
    const MANY = [character('Nia', 'Main', 3)];

    it('is a real button that says how many more there are', () => {
      renderCast(MANY);

      const button = within(card('Nia')).getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).toHaveTextContent('+2 more VAs');
    });

    it('counts a single extra in the singular', () => {
      renderCast([character('Nia', 'Main', 2)]);

      expect(within(card('Nia')).getByRole('button')).toHaveTextContent('+1 more VA');
    });

    it('lists every voice actor, each linked, when opened', async () => {
      renderCast(MANY);

      await userEvent.click(within(card('Nia')).getByRole('button'));

      const nia = card('Nia');
      await waitFor(() => expect(nia.querySelector('.char-va-list')).toBeInTheDocument());
      const links = within(nia).getAllByRole('link');
      expect(links.map((link) => link.getAttribute('href'))).toEqual([
        '/people/Nia-0',
        '/people/Nia-1',
        '/people/Nia-2'
      ]);
    });

    it('says it is open, and closes again on a second press', async () => {
      renderCast(MANY);
      const button = within(card('Nia')).getByRole('button');

      await userEvent.click(button);
      await waitFor(() => expect(button).toHaveAttribute('aria-expanded', 'true'));
      expect(card('Nia')).toHaveClass('expanded');

      await userEvent.click(button);
      await waitFor(() => expect(button).toHaveAttribute('aria-expanded', 'false'));
      expect(card('Nia').querySelector('.char-va-list')).not.toBeInTheDocument();
    });

    it('opens only the card that was pressed', async () => {
      renderCast([character('Nia', 'Main', 2), character('Adam', 'Main', 2)]);

      await userEvent.click(within(card('Nia')).getByRole('button'));

      await waitFor(() => expect(card('Nia').querySelector('.char-va-list')).toBeInTheDocument());
      expect(card('Adam').querySelector('.char-va-list')).not.toBeInTheDocument();
    });

    it('gives a card with one voice actor nothing to press', () => {
      renderCast([character('Solo', 'Main', 1)]);

      const solo = card('Solo');
      expect(within(solo).queryByRole('button')).not.toBeInTheDocument();
      expect(solo.querySelector('.char-card-main')?.tagName).toBe('DIV');
      expect(solo.querySelector('.char-va-more')).not.toBeInTheDocument();
    });
  });
});
