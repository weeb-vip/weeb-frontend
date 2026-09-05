import { fromStore, type Readable } from 'svelte/store';
import { preferencesStore, type TitleLanguage } from '../stores/preferences';

/**
 * The slice of the preferences store this bloc actually needs.
 *
 * Narrowing the dependency to a port is the whole point: the real store
 * touches localStorage on every toggle, so a story or a unit test can pass a
 * plain in-memory stand-in instead of the singleton.
 */
export interface PreferencesPort extends Readable<{ titleLanguage: TitleLanguage }> {
  toggleTitleLanguage: () => void;
}

/**
 * Business logic for the title-language toggle: which language is active, the
 * labels that describe it, and the intent that flips it. The view renders
 * these and nothing else.
 */
export class TitleLanguageToggleBloc {
  readonly #prefs: PreferencesPort;
  readonly #state: { current: { titleLanguage: TitleLanguage } };

  constructor(prefs: PreferencesPort = preferencesStore) {
    this.#prefs = prefs;
    this.#state = fromStore(prefs);
  }

  get language(): TitleLanguage {
    return this.#state.current.titleLanguage;
  }

  get isEnglish(): boolean {
    return this.language === 'english';
  }

  /** The code shown in the button on wider viewports. */
  get shortLabel(): string {
    return this.isEnglish ? 'EN' : 'JP';
  }

  /**
   * Describes what pressing the button will DO, not the current state -- that
   * is what a screen reader needs from an action's accessible name.
   */
  get actionLabel(): string {
    return this.isEnglish ? 'Show titles in Japanese' : 'Show titles in English';
  }

  toggle(): void {
    this.#prefs.toggleTitleLanguage();
  }
}
