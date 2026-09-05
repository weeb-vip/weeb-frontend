import type { Meta, StoryObj } from '@storybook/svelte';
import { writable } from 'svelte/store';
import AnimeCalendarPopover from '../AnimeCalendarPopover.svelte';
import {
  AnimeCalendarPopoverBloc,
  type MediaQueryPort,
} from '../AnimeCalendarPopover.bloc.svelte';
import StoryContainer from './StoryContainer.svelte';

/** A viewport that never changes, so no story listens to a real breakpoint. */
function stubMediaQuery(matches: boolean): MediaQueryPort {
  return { matches: () => matches, onChange: () => () => {} };
}

const anime = {
  id: '154587',
  slug: 'sousou-no-frieren',
  titleEn: 'Frieren: Beyond Journey\'s End',
  titleJp: '葬送のフリーレン',
  episodeCount: 28,
  duration: '24 min per ep',
  startDate: '2023-09-29T00:00:00Z',
  tags: ['Adventure', 'Drama', 'Fantasy'],
  episodeAirTime: new Date('2024-03-22T14:00:00Z'),
  episodes: [
    {
      episodeNumber: 24,
      titleEn: 'The Height of Magic',
      airDate: '2024-03-22T14:00:00Z',
    },
  ],
};

function bloc(overrides: Record<string, unknown> = {}, compact = false) {
  return new AnimeCalendarPopoverBloc(
    { anime: { ...anime, ...overrides } },
    {
      preferences: writable({ titleLanguage: 'english' as const }),
      mediaQuery: stubMediaQuery(compact),
    }
  );
}

function opened(instance: AnimeCalendarPopoverBloc) {
  instance.togglePopover();
  return instance;
}

const meta = {
  title: 'Design System/AnimeCalendarPopover',
  component: AnimeCalendarPopover,
  tags: ['autodocs'],
  decorators: [
    () => ({
      Component: StoryContainer,
      props: { width: '180px' },
    }),
  ],
} satisfies Meta<typeof AnimeCalendarPopover>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The calendar cell at rest: title, episode number and the air time. */
export const Closed: Story = {
  args: { anime, bloc: bloc() },
};

/**
 * Open. `anchoredPosition` places the card in viewport coordinates -- the old
 * maths added `window.scrollY` to a `position: fixed` element, so the card
 * drifted down the page by exactly the scroll offset.
 */
export const Open: Story = {
  args: { anime, bloc: opened(bloc()) },
};

/** Phone width: the card centres on its cell instead of hanging off its left edge. */
export const OpenOnPhone: Story = {
  args: { anime, bloc: opened(bloc({}, true)) },
};

/** No resolved air time: the cell shows the title alone, the card the raw date. */
export const WithoutAirTime: Story = {
  args: {
    anime,
    bloc: bloc({ episodeAirTime: null }),
  },
};

/** An episode with neither a number nor a title -- both fall back. */
export const UnknownEpisode: Story = {
  args: {
    anime,
    bloc: opened(bloc({ episodeAirTime: null, episodes: [{}] })),
  },
};

/** Japanese titles selected, to show the cell follows the preference. */
export const JapaneseTitle: Story = {
  args: {
    anime,
    bloc: new AnimeCalendarPopoverBloc(
      { anime },
      {
        preferences: writable({ titleLanguage: 'japanese' as const }),
        mediaQuery: stubMediaQuery(false),
      }
    ),
  },
};
