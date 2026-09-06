import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { STATUS_LABELS, STATUS_OPTIONS } from '$lib/utils/status';
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
