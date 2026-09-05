import type { Meta, StoryObj } from '@storybook/svelte';
import { writable } from 'svelte/store';
import TitleLanguageToggle from '../TitleLanguageToggle.svelte';
import {
  TitleLanguageToggleBloc,
  type PreferencesPort,
} from '../TitleLanguageToggle.bloc.svelte';
import type { TitleLanguage } from '../../stores/preferences';

/**
 * In-memory stand-in for the preferences store. The real one reads and writes
 * localStorage, which a story has no business touching -- and which would leak
 * state from one story into the next.
 */
function stubPreferences(titleLanguage: TitleLanguage): PreferencesPort {
  const { subscribe, update } = writable({ titleLanguage });
  return {
    subscribe,
    toggleTitleLanguage: () =>
      update((prefs) => ({
        titleLanguage: prefs.titleLanguage === 'english' ? 'japanese' : 'english',
      })),
  };
}

const meta = {
  title: 'Composites/App Shell/TitleLanguageToggle',
  component: TitleLanguageToggle,
  tags: ['autodocs'],
} satisfies Meta<typeof TitleLanguageToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Titles are shown in English; pressing the button switches to Japanese. */
export const English: Story = {
  args: {
    bloc: new TitleLanguageToggleBloc(stubPreferences('english')),
  },
};

/** Titles are shown in Japanese; pressing the button switches back. */
export const Japanese: Story = {
  args: {
    bloc: new TitleLanguageToggleBloc(stubPreferences('japanese')),
  },
};
