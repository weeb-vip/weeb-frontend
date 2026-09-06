import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { STATUS_LABELS, STATUS_OPTIONS } from '$lib/utils/status';
import AnimeStatusDropdown from './AnimeStatusDropdown.svelte';
import { stubWebAnimations } from '$lib/components/__tests__/jsdom-gaps';
import {
  AnimeStatusDropdownBloc,
  type AnimeStatusDropdownEntry,
  type AnimeStatusDropdownInputs,
  type AnimeStatusDropdownVariant
} from './AnimeStatusDropdown.bloc.svelte';

const entry = (overrides: Partial<AnimeStatusDropdownEntry> = {}): AnimeStatusDropdownEntry => ({
  id: 'ua1',
  anime: { id: 'a1' },
  ...overrides
});

function makeBloc(
  inputs: Partial<AnimeStatusDropdownInputs> = {},
  queryClient = { init: vi.fn() }
) {
  const full: AnimeStatusDropdownInputs = {
    entry: entry(),
    variant: 'default',
    buttonClassName: '',
    ...inputs
  };
  return new AnimeStatusDropdownBloc(full, { queryClient });
}

describe('AnimeStatusDropdownBloc', () => {
  describe('the menu', () => {
    it('starts closed', () => {
      expect(makeBloc().isMenuOpen).toBe(false);
    });

    it('toggles both ways and closes', () => {
      const bloc = makeBloc();

      bloc.toggleMenu();
      expect(bloc.isMenuOpen).toBe(true);

      bloc.toggleMenu();
      expect(bloc.isMenuOpen).toBe(false);

      bloc.toggleMenu();
      bloc.closeMenu();
      expect(bloc.isMenuOpen).toBe(false);
    });
  });

  describe('what it offers', () => {
    it('offers the app’s whole status vocabulary', () => {
      expect(makeBloc().statusOptions).toEqual(STATUS_OPTIONS);
    });

    it('labels each status the way the rest of the app does', () => {
      const bloc = makeBloc();

      for (const status of STATUS_OPTIONS) {
        expect(bloc.labelFor(status)).toBe(STATUS_LABELS[status]);
      }
    });

    it('reads an untracked entry as plan-to-watch', () => {
      const bloc = makeBloc({ entry: entry({ status: undefined }) });

      expect(bloc.currentStatus).toBe('PLANTOWATCH');
      expect(bloc.currentLabel).toBe('Plan to Watch');
    });

    it('shows the entry’s own status when it has one', () => {
      const bloc = makeBloc({ entry: entry({ status: 'WATCHING' }) });

      expect(bloc.currentStatus).toBe('WATCHING');
      expect(bloc.currentLabel).toBe('Watching');
    });

    it('marks only the status actually recorded, never the plan-to-watch default', () => {
      const untracked = makeBloc({ entry: entry({ status: undefined }) });

      // The trigger reads "Plan to Watch", but no row in the menu is ticked.
      expect(untracked.currentStatus).toBe('PLANTOWATCH');
      expect(STATUS_OPTIONS.some((s) => untracked.isSelected(s))).toBe(false);

      const watching = makeBloc({ entry: entry({ status: 'WATCHING' }) });
      expect(watching.isSelected('WATCHING')).toBe(true);
      expect(watching.isSelected('COMPLETED')).toBe(false);
    });
  });

  describe('the four shapes', () => {
    const variants: AnimeStatusDropdownVariant[] = ['default', 'compact', 'hero', 'icon-only'];

    it('reports the variant it was given', () => {
      for (const variant of variants) {
        expect(makeBloc({ variant }).variant).toBe(variant);
      }
    });

    it('gives compact a full-width row and icon-only its own inline box', () => {
      expect(makeBloc({ variant: 'compact' }).containerClasses).toContain('w-full');
      expect(makeBloc({ variant: 'icon-only' }).containerClasses).toBe(
        'relative inline-block text-left'
      );
    });

    it('draws default and hero in the same container', () => {
      expect(makeBloc({ variant: 'hero' }).containerClasses).toBe(
        makeBloc({ variant: 'default' }).containerClasses
      );
    });

    it('gives every variant the shared button class plus its own modifier', () => {
      for (const variant of variants) {
        expect(makeBloc({ variant }).buttonClasses).toContain('asd-btn');
      }
      expect(makeBloc({ variant: 'compact' }).buttonClasses).toBe('asd-btn asd-btn--compact');
      expect(makeBloc({ variant: 'hero' }).buttonClasses).toBe('asd-btn asd-btn--hero');
      expect(makeBloc({ variant: 'icon-only' }).buttonClasses).toBe('asd-btn asd-btn--icon');
      expect(makeBloc({ variant: 'default' }).buttonClasses).toBe('asd-btn');
    });

    it('lets a caller’s class replace the variant’s, keeping the base', () => {
      expect(makeBloc({ variant: 'hero', buttonClassName: 'my-btn' }).buttonClasses).toBe(
        'asd-btn my-btn'
      );
    });
  });

  describe('the choices', () => {
    it('reports the anime’s id, not the list row’s, and closes', () => {
      const onStatusChange = vi.fn();
      const bloc = makeBloc({ entry: entry({ status: 'WATCHING' }), onStatusChange });
      bloc.toggleMenu();

      bloc.selectStatus('COMPLETED');

      expect(onStatusChange).toHaveBeenCalledWith({ animeId: 'a1', status: 'COMPLETED' });
      expect(bloc.isMenuOpen).toBe(false);
    });

    it('reports removal and closes', () => {
      const onDelete = vi.fn();
      const bloc = makeBloc({ onDelete });
      bloc.toggleMenu();

      bloc.removeFromList();

      expect(onDelete).toHaveBeenCalledWith({ animeId: 'a1' });
      expect(bloc.isMenuOpen).toBe(false);
    });

    it('reports an empty id rather than undefined for an entry with no anime', () => {
      const onStatusChange = vi.fn();
      const onDelete = vi.fn();
      const bloc = makeBloc({ entry: entry({ anime: undefined }), onStatusChange, onDelete });

      bloc.selectStatus('WATCHING');
      bloc.removeFromList();

      expect(onStatusChange).toHaveBeenCalledWith({ animeId: '', status: 'WATCHING' });
      expect(onDelete).toHaveBeenCalledWith({ animeId: '' });
    });

    it('still closes when the caller wired up no handler at all', () => {
      const bloc = makeBloc();
      bloc.toggleMenu();

      expect(() => bloc.selectStatus('WATCHING')).not.toThrow();
      expect(() => bloc.removeFromList()).not.toThrow();
      expect(bloc.isMenuOpen).toBe(false);
    });
  });

  describe('warming the query client', () => {
    let warned: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      warned = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => warned.mockRestore());

    it('opens the connection so the mutation is not also a cold handshake', () => {
      const queryClient = { init: vi.fn() };

      makeBloc({}, queryClient).init();

      expect(queryClient.init).toHaveBeenCalledTimes(1);
    });

    it('survives a client that will not initialise', () => {
      const queryClient = {
        init: vi.fn(() => {
          throw new Error('no client');
        })
      };

      expect(() => makeBloc({}, queryClient).init()).not.toThrow();
      expect(warned).toHaveBeenCalled();
    });
  });
});

/**
 * The trigger, the menu it opens, and what each row does.
 *
 * The rules behind them -- which statuses exist, what "no status yet" reads as,
 * which class each variant's trigger takes -- are asserted against the bloc
 * above. This half is the markup: that the trigger says what is open, that the
 * menu is portalled out to `<body>` (so `screen`, never the render container),
 * that every option and the destructive row reach their callbacks, and that the
 * shared `clickOutside` action is what dismisses it.
 *
 * jsdom caveats: no stylesheets are loaded (`document.styleSheets` is empty),
 * so the destructive row's red is only assertable as the class the stylesheet
 * keys on, never as a colour; and `anchoredPosition` measures with
 * `getBoundingClientRect`, which is all zeros here, so where the menu lands is
 * a browser fact and is not asserted.
 */
describe('AnimeStatusDropdown', () => {
  // The menu opens and closes on `transition:scale`, which Svelte drives
  // through `element.animate` -- absent from jsdom entirely.
  let restoreAnimations: () => void;
  beforeEach(() => {
    restoreAnimations = stubWebAnimations();
  });
  afterEach(() => restoreAnimations());

  const queryClient = () => ({ init: vi.fn() });

  function renderDropdown(
    props: {
      entry?: AnimeStatusDropdownEntry;
      variant?: AnimeStatusDropdownVariant;
      onStatusChange?: (detail: { animeId: string; status: string }) => void;
      onDelete?: (detail: { animeId: string }) => void;
    } = {}
  ) {
    const onStatusChange = props.onStatusChange ?? vi.fn();
    const onDelete = props.onDelete ?? vi.fn();
    const client = queryClient();
    const bloc = new AnimeStatusDropdownBloc(
      {
        entry: props.entry ?? entry({ status: 'WATCHING' }),
        variant: props.variant ?? 'default',
        buttonClassName: '',
        onStatusChange,
        onDelete
      },
      { queryClient: client }
    );
    const result = render(AnimeStatusDropdown, {
      props: { entry: props.entry ?? entry({ status: 'WATCHING' }), bloc }
    });
    return { ...result, onStatusChange, onDelete, client, bloc };
  }

  /**
   * The trigger, not a menu row. Once the menu is open the row for the entry's
   * current status carries the same visible text, so the label alone is
   * ambiguous; `aria-haspopup` is what makes this the control that opens things.
   */
  const trigger = () =>
    screen.getAllByRole('button').find((button) => button.getAttribute('aria-haspopup') === 'menu')!;

  /** The portalled surface, for queries that must not reach the trigger. */
  const menu = () => document.querySelector('.asd-menu') as HTMLElement;

  async function openMenu(rendered = renderDropdown()) {
    await userEvent.click(trigger());
    await screen.findByRole('button', { name: 'Remove from list' });
    return rendered;
  }

  describe('the trigger', () => {
    it('shows the entry’s current status and says the menu is shut', () => {
      renderDropdown({ entry: entry({ status: 'COMPLETED' }) });

      const button = screen.getByRole('button', { name: 'Completed' });
      expect(button).toHaveAttribute('aria-haspopup', 'menu');
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('reads an entry with no status yet as "Plan to Watch"', () => {
      renderDropdown({ entry: entry() });

      expect(screen.getByRole('button', { name: 'Plan to Watch' })).toBeInTheDocument();
    });

    it('warms the query client once the control is live, so the first write is not a cold handshake', () => {
      const { client } = renderDropdown();

      expect(client.init).toHaveBeenCalled();
    });

    describe('the icon-only variant', () => {
      it('carries the status in a title instead of a visible label', () => {
        const bloc = new AnimeStatusDropdownBloc(
          { entry: entry({ status: 'DROPPED' }), variant: 'icon-only', buttonClassName: '' },
          { queryClient: queryClient() }
        );
        render(AnimeStatusDropdown, {
          props: { entry: entry({ status: 'DROPPED' }), variant: 'icon-only', bloc }
        });

        const button = screen.getByRole('button');
        expect(button).toHaveAttribute('title', 'Status: Dropped');
        expect(button).toHaveTextContent('');
      });

      it('heads its menu, which the labelled variant does not need', async () => {
        const bloc = new AnimeStatusDropdownBloc(
          { entry: entry({ status: 'DROPPED' }), variant: 'icon-only', buttonClassName: '' },
          { queryClient: queryClient() }
        );
        render(AnimeStatusDropdown, {
          props: { entry: entry({ status: 'DROPPED' }), variant: 'icon-only', bloc }
        });

        await userEvent.click(screen.getByRole('button'));

        expect(await screen.findByText('Change Status')).toBeInTheDocument();
      });
    });
  });

  describe('opening the menu', () => {
    it('draws nothing until the trigger is used', () => {
      renderDropdown();

      expect(screen.queryByRole('button', { name: 'Remove from list' })).not.toBeInTheDocument();
    });

    it('offers every status, in order, when opened', async () => {
      await openMenu();

      const options = screen
        .getAllByRole('button')
        .map((button) => button.textContent?.trim())
        .filter((label) => label && label !== 'Remove from list');

      // The trigger repeats the current label, so drop the first.
      expect(options.slice(1)).toEqual([
        'Watching',
        'Completed',
        'On Hold',
        'Dropped',
        'Plan to Watch'
      ]);
    });

    it('says the menu is open on the trigger', async () => {
      await openMenu();

      expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    });

    it('ticks the status the entry already has, and only that one', async () => {
      await openMenu(renderDropdown({ entry: entry({ status: 'ONHOLD' }) }));

      const active = Array.from(menu().querySelectorAll('.asd-menu-item--active'));
      expect(active).toHaveLength(1);
      expect(active[0]).toHaveTextContent('On Hold');
      expect(active[0]!.querySelector('.asd-check')).toBeInTheDocument();
    });

    /**
     * An entry with no status yet has nothing ticked: the trigger reads "Plan to
     * Watch" as a default, which is not the same as the reader having chosen it.
     */
    it('ticks nothing for an entry that has never been given a status', async () => {
      await openMenu(renderDropdown({ entry: entry() }));

      expect(document.querySelectorAll('.asd-menu-item--active')).toHaveLength(0);
    });

    it('portals the menu to <body>, clear of any transformed ancestor', async () => {
      const { container } = await openMenu(renderDropdown());

      const remove = screen.getByRole('button', { name: 'Remove from list' });
      expect(container.contains(remove)).toBe(false);
      expect(document.body.contains(remove)).toBe(true);
    });
  });

  describe('choosing a status', () => {
    it('reports the anime and the new status, then shuts the menu', async () => {
      const { onStatusChange } = await openMenu();

      await userEvent.click(within(menu()).getByRole('button', { name: 'Completed' }));

      expect(onStatusChange).toHaveBeenCalledWith({ animeId: 'a1', status: 'COMPLETED' });
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Remove from list' })).not.toBeInTheDocument();
      });
    });

    it('reports every one of the five, not just the first', async () => {
      const pairs: [string, string][] = [
        ['Watching', 'WATCHING'],
        ['Completed', 'COMPLETED'],
        ['On Hold', 'ONHOLD'],
        ['Dropped', 'DROPPED'],
        ['Plan to Watch', 'PLANTOWATCH']
      ];

      for (const [label, status] of pairs) {
        cleanup();
        const onStatusChange = vi.fn();
        // A status the entry does not already hold, so the trigger's own label
        // never collides with the option being clicked.
        await openMenu(renderDropdown({ onStatusChange }));

        await userEvent.click(within(menu()).getByRole('button', { name: label }));

        expect(onStatusChange).toHaveBeenCalledWith({ animeId: 'a1', status });
      }
    });
  });

  /**
   * DESIGN_SYSTEM, "Destructive actions": a row in a menu is red text with a
   * `--weeb-red-tint` hover -- never a filled red button, because a menu is a
   * list of peers and filling one makes the destructive option the most salient
   * thing on screen.
   *
   * jsdom loads no stylesheets, so the tint itself is not observable. What is:
   * the row is the same `.asd-menu-item` as its four peers, plus one modifier.
   * A filled button would have had to be a different element or a different
   * base class, which is exactly what this pins.
   */
  describe('the destructive row', () => {
    it('is a peer of the status rows carrying only a danger modifier', async () => {
      await openMenu();

      const remove = screen.getByRole('button', { name: 'Remove from list' });
      expect(remove).toHaveClass('asd-menu-item');
      expect(remove).toHaveClass('asd-menu-item--danger');
      // Not a Button: the shared primitive's classes are what a filled control
      // would carry.
      expect(remove.className).not.toMatch(/weeb-button|asd-btn/);
    });

    it('sits below a divider, at the end of the list', async () => {
      await openMenu();

      const children = Array.from(menu().children);
      expect(children.at(-1)).toHaveTextContent('Remove from list');
      expect(children.at(-2)).toHaveClass('asd-menu-divider');
    });

    it('reports the anime and shuts the menu', async () => {
      const { onDelete } = await openMenu();

      await userEvent.click(screen.getByRole('button', { name: 'Remove from list' }));

      expect(onDelete).toHaveBeenCalledWith({ animeId: 'a1' });
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Remove from list' })).not.toBeInTheDocument();
      });
    });
  });

  describe('dismissal', () => {
    /**
     * The menu is portalled, so it is a descendant of nothing the trigger owns.
     * `clickOutside` is what closes it, with the trigger passed as an `ignore`
     * so the click that opened it cannot immediately close it again.
     */
    it('closes on a click anywhere outside it', async () => {
      await openMenu();

      await userEvent.click(document.body);

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Remove from list' })).not.toBeInTheDocument();
      });
    });

    it('does not close on a click inside the menu that is not a row', async () => {
      await openMenu();

      await userEvent.click(menu().querySelector('.asd-menu-divider') as HTMLElement);

      expect(screen.getByRole('button', { name: 'Remove from list' })).toBeInTheDocument();
    });

    it('closes when the trigger is used a second time', async () => {
      await openMenu();

      await userEvent.click(trigger());

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Remove from list' })).not.toBeInTheDocument();
      });
    });

    it('takes its listener with it when the control is destroyed while open', async () => {
      const { unmount } = await openMenu();

      unmount();

      // The portalled node is removed with the component, not orphaned on <body>.
      expect(document.querySelector('.asd-menu')).not.toBeInTheDocument();
    });
  });
});
