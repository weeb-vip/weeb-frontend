import { describe, it, expect, vi } from 'vitest';
import { writable } from 'svelte/store';
import type { TitleLanguage } from '$lib/stores/preferences';
import { TitleLanguageToggleBloc, type PreferencesPort } from './TitleLanguageToggle.bloc.svelte';

/** The preferences store's two-member slice, with no localStorage behind it. */
function prefs(initial: TitleLanguage = 'english') {
  const store = writable<{ titleLanguage: TitleLanguage }>({ titleLanguage: initial });
  const toggleTitleLanguage = vi.fn(() =>
    store.update(({ titleLanguage }) => ({
      titleLanguage: titleLanguage === 'english' ? 'japanese' : 'english'
    }))
  );

  return Object.assign(store, { toggleTitleLanguage }) as PreferencesPort &
    typeof store & { toggleTitleLanguage: typeof toggleTitleLanguage };
}

describe('TitleLanguageToggleBloc', () => {
  it('reads the language out of the store', () => {
    expect(new TitleLanguageToggleBloc(prefs('english')).language).toBe('english');
    expect(new TitleLanguageToggleBloc(prefs('japanese')).language).toBe('japanese');
  });

  it('treats only English as English', () => {
    expect(new TitleLanguageToggleBloc(prefs('english')).isEnglish).toBe(true);
    expect(new TitleLanguageToggleBloc(prefs('japanese')).isEnglish).toBe(false);
  });

  it('shows the two-letter code the button renders', () => {
    expect(new TitleLanguageToggleBloc(prefs('english')).shortLabel).toBe('EN');
    expect(new TitleLanguageToggleBloc(prefs('japanese')).shortLabel).toBe('JP');
  });

  it('names what pressing the button will do, not what is showing now', () => {
    // That is what a screen reader needs from an action's accessible name.
    expect(new TitleLanguageToggleBloc(prefs('english')).actionLabel).toBe(
      'Show titles in Japanese'
    );
    expect(new TitleLanguageToggleBloc(prefs('japanese')).actionLabel).toBe(
      'Show titles in English'
    );
  });

  it('forwards the toggle to the store rather than holding its own copy', () => {
    const port = prefs('english');
    const bloc = new TitleLanguageToggleBloc(port);

    bloc.toggle();

    expect(port.toggleTitleLanguage).toHaveBeenCalledTimes(1);
    expect(bloc.language).toBe('japanese');
    expect(bloc.shortLabel).toBe('JP');
  });

  it('follows a change made anywhere else', () => {
    const port = prefs('english');
    const bloc = new TitleLanguageToggleBloc(port);

    port.set({ titleLanguage: 'japanese' });

    expect(bloc.isEnglish).toBe(false);
  });
});
