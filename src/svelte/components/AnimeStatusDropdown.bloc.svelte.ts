import { initializeQueryClient } from '../services/query-client';
import { STATUS_LABELS, STATUS_OPTIONS } from '../utils/status';

export type AnimeStatusDropdownVariant = 'default' | 'compact' | 'hero' | 'icon-only';

export interface AnimeStatusDropdownEntry {
  id: string;
  anime?: {
    id?: string;
  };
  status?: string;
}

/** The props the view feeds in. Getters, so the bloc reads them live. */
export interface AnimeStatusDropdownInputs {
  readonly entry: AnimeStatusDropdownEntry;
  readonly variant: AnimeStatusDropdownVariant;
  readonly buttonClassName: string;
  /** The caller changed this entry's status. */
  readonly onStatusChange?: (detail: { animeId: string; status: string }) => void;
  /** The caller asked for this entry to leave their list. */
  readonly onDelete?: (detail: { animeId: string }) => void;
}

/**
 * Warming the query client is the one side effect this component has ever had
 * -- it opens the GraphQL connection so the mutation the menu is about to fire
 * is not also paying for a cold handshake. A port, so a story does not.
 */
export interface QueryClientPort {
  init: () => unknown;
}

export interface AnimeStatusDropdownDeps {
  queryClient?: QueryClientPort;
}

/**
 * The status menu: whether it is open, what it offers, and what each choice
 * means. Placement is no longer here at all -- `anchoredPosition` owns that,
 * and it measures the menu rather than assuming the 280x200 box this class
 * used to hard-code.
 */
export class AnimeStatusDropdownBloc {
  readonly #inputs: AnimeStatusDropdownInputs;
  readonly #queryClient: QueryClientPort;

  #isMenuOpen = $state(false);

  constructor(inputs: AnimeStatusDropdownInputs, deps: AnimeStatusDropdownDeps = {}) {
    this.#inputs = inputs;
    this.#queryClient = deps.queryClient ?? { init: initializeQueryClient };
  }

  /** Mirrors the old onMount: warm the client once the component is live. */
  init(): void {
    try {
      this.#queryClient.init();
    } catch (error) {
      console.warn('Failed to initialize query client:', error);
    }
  }

  get isMenuOpen(): boolean {
    return this.#isMenuOpen;
  }

  get statusOptions(): readonly string[] {
    return STATUS_OPTIONS;
  }

  labelFor(status: string): string {
    return STATUS_LABELS[status];
  }

  /** The status the trigger displays. Unset entries read as plan-to-watch. */
  get currentStatus(): string {
    return this.#inputs.entry.status ?? 'PLANTOWATCH';
  }

  get currentLabel(): string {
    return this.labelFor(this.currentStatus);
  }

  isSelected(status: string): boolean {
    return this.#inputs.entry.status === status;
  }

  get variant(): AnimeStatusDropdownVariant {
    return this.#inputs.variant;
  }

  get containerClasses(): string {
    const base = 'flex flex-row relative items-center gap-2 justify-center';
    switch (this.#inputs.variant) {
      case 'compact':
        return `${base} w-full`;
      case 'icon-only':
        return 'relative inline-block text-left';
      case 'hero':
      default:
        return base;
    }
  }

  get buttonClasses(): string {
    if (this.#inputs.buttonClassName) {
      return `asd-btn ${this.#inputs.buttonClassName}`;
    }
    switch (this.#inputs.variant) {
      case 'compact':
        return 'asd-btn asd-btn--compact';
      case 'hero':
        return 'asd-btn asd-btn--hero';
      case 'icon-only':
        return 'asd-btn asd-btn--icon';
      default:
        return 'asd-btn';
    }
  }

  toggleMenu(): void {
    this.#isMenuOpen = !this.#isMenuOpen;
  }

  closeMenu(): void {
    this.#isMenuOpen = false;
  }

  selectStatus(status: string): void {
    this.#inputs.onStatusChange?.({
      animeId: this.#inputs.entry.anime?.id || '',
      status
    });
    this.closeMenu();
  }

  removeFromList(): void {
    this.#inputs.onDelete?.({ animeId: this.#inputs.entry.anime?.id || '' });
    this.closeMenu();
  }
}
