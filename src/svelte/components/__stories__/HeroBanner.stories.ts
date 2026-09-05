import type { Meta, StoryObj } from '@storybook/svelte';
import { readable, writable } from 'svelte/store';
import HeroBanner from '../HeroBanner.svelte';
import { HeroBannerBloc, type MediaQueryPort } from '../HeroBanner.bloc.svelte';
import type { EpisodeTiming } from '../../../services/airTimeUtils';

/** Nothing here reaches config.json, a worker, localStorage or matchMedia. */
const noConfig = { init: async () => null };
const noNotifications = readable({ timingData: {}, countdowns: {} });

function stubMediaQuery(isPhone: boolean): MediaQueryPort {
  return { matches: () => isPhone, onChange: () => () => {} };
}

/** A stand-in CDN: one real poster whatever folder is asked for. */
const stubImageUrl = () => 'https://cdn.myanimelist.net/images/anime/1015/138006.jpg';

const anime = {
  id: '154587',
  slug: 'sousou-no-frieren',
  titleEn: 'Frieren: Beyond Journey\'s End',
  titleJp: '葬送のフリーレン',
  description:
    'The adventure is over but life goes on for an elf mage just beginning to learn what living is all about.',
  streamingPlatforms: ['Crunchyroll'],
  broadcast: 'Fridays at 23:00 (JST)',
};

function timing(overrides: Partial<EpisodeTiming> = {}): EpisodeTiming {
  return {
    airDateTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
    isLive: false,
    hasAired: false,
    countdown: '2h',
    label: 'Airing in 2h',
    localTime: 'Fri 7:00 AM',
    variant: 'countdown',
    localZone: 'PDT',
    broadcastSlot: 'Fridays at 23:00 (JST)',
    exact: true,
    ...overrides,
  };
}

function bloc(options: {
  anime?: Record<string, unknown>;
  timing?: EpisodeTiming | null;
  loggedIn?: boolean;
  authInitialized?: boolean;
  isPhone?: boolean;
  notifications?: any;
} = {}) {
  return new HeroBannerBloc(
    {
      anime: { ...anime, ...options.anime },
      timing: options.timing ?? null,
    },
    {
      config: noConfig,
      notifications: options.notifications ?? noNotifications,
      preferences: writable({ titleLanguage: 'english' as const }),
      auth: writable({
        isLoggedIn: options.loggedIn ?? true,
        isAuthInitialized: options.authInitialized ?? true,
      }),
      imageUrl: stubImageUrl,
      webPProbe: async () => true,
      mediaQuery: stubMediaQuery(options.isPhone ?? false),
    }
  );
}

const meta = {
  title: 'Design System/HeroBanner',
  component: HeroBanner,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof HeroBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An episode a couple of hours out: the "Next Episode" badge with a countdown. */
export const Upcoming: Story = {
  args: { anime, bloc: bloc({ timing: timing() }) },
};

/** Inside the six-hour window, where "Airing Soon" is honest. */
export const AiringSoon: Story = {
  args: {
    anime,
    bloc: bloc({
      timing: timing({ airDateTime: new Date(Date.now() + 45 * 60 * 1000), countdown: '45m' }),
    }),
  },
};

/**
 * On air. The badge fills with the episode's progress, which only the
 * notification worker computes -- so this story feeds one.
 */
export const CurrentlyAiring: Story = {
  args: {
    anime,
    bloc: bloc({
      timing: timing({ isLive: true, countdown: '12m left', variant: 'airing' }),
      notifications: readable({
        timingData: { '154587': { progress: 0.5, episode: { episodeNumber: 24 } } },
        countdowns: {},
      }),
    }),
  },
};

/** Finished within the week: the green "Recently Aired" badge. */
export const RecentlyAired: Story = {
  args: {
    anime,
    bloc: bloc({
      timing: timing({ hasAired: true, countdown: '', variant: 'aired' }),
    }),
  },
};

/** The fallback banner (top-rated): no schedule at all, so no badge and no times. */
export const WithoutSchedule: Story = {
  args: { anime, bloc: bloc() },
};

/** Signed out, once auth has resolved: the one line saying what an account is for. */
export const SignedOut: Story = {
  args: {
    anime,
    bloc: bloc({ timing: timing(), loggedIn: false }),
  },
};

/**
 * A phone. The source order flips to prefer the tall poster over the 16:9
 * banner, and the CDN is asked for 800px rather than 1600.
 */
export const OnPhone: Story = {
  args: {
    anime,
    bloc: bloc({ timing: timing(), isPhone: true }),
  },
};

/** A title long enough to drop to the smallest of the three display steps. */
export const LongTitle: Story = {
  args: {
    anime,
    bloc: bloc({
      anime: {
        titleEn:
          'The Exiled Heavy Knight Knows How to Game the System and Will Not Be Returning to the Capital',
      },
      timing: timing(),
    }),
  },
};

/** No artwork and no synopsis: the panel still holds its shape. */
export const WithoutArtwork: Story = {
  args: {
    anime,
    bloc: new HeroBannerBloc(
      { anime: { ...anime, id: null, description: '' }, timing: timing() },
      {
        config: noConfig,
        notifications: noNotifications,
        preferences: writable({ titleLanguage: 'english' as const }),
        auth: writable({ isLoggedIn: true, isAuthInitialized: true }),
        imageUrl: stubImageUrl,
        webPProbe: async () => true,
        mediaQuery: stubMediaQuery(false),
      }
    ),
  },
};
