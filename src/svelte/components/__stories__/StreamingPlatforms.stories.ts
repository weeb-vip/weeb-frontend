import type { Meta, StoryObj } from '@storybook/svelte';
import StreamingPlatforms from '../StreamingPlatforms.svelte';
import {
  StreamingPlatformsBloc,
  type FeatureFlagPort,
} from '../StreamingPlatforms.bloc.svelte';

/**
 * The real gate asks PostHog and then polls until the flag resolves. A story
 * has no PostHog, so it answers straight away -- and the poll never starts.
 */
function stubFlags(enabled: boolean): FeatureFlagPort {
  return { isEnabled: () => enabled };
}

const PLATFORMS = [
  { platform: 'Crunchyroll', name: 'Crunchyroll', url: 'https://crunchyroll.com/frieren' },
  { platform: 'Netflix', name: 'Netflix', url: 'https://netflix.com/title/81726445' },
  { platform: 'Prime Video', name: 'Prime Video', url: 'https://primevideo.com/detail/frieren' },
];

const meta = {
  title: 'Show/StreamingPlatforms',
  component: StreamingPlatforms,
  tags: ['autodocs'],
} satisfies Meta<typeof StreamingPlatforms>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The flag is on and the show has listings: bundled brand logos, one row. */
export const Enabled: Story = {
  args: {
    platforms: PLATFORMS,
    bloc: new StreamingPlatformsBloc({ flags: stubFlags(true) }),
  },
};

/** The flag is off, so the whole row is absent rather than empty. */
export const FlagOff: Story = {
  args: {
    platforms: PLATFORMS,
    bloc: new StreamingPlatformsBloc({ flags: stubFlags(false) }),
  },
};

/**
 * A platform with no bundled logo falls back to the generic mark, and a URL
 * with no scheme is sent out as https rather than resolving as a local path.
 */
export const UnknownPlatformAndBareUrl: Story = {
  args: {
    platforms: [
      { platform: 'Bahamut Anime', name: 'Bahamut Anime', url: 'ani.gamer.com.tw/frieren' },
      { platform: 'Bilibili', name: null, url: 'https://bilibili.com/frieren' },
    ],
    bloc: new StreamingPlatformsBloc({ flags: stubFlags(true) }),
  },
};

/** Flag on, but this show has no listings -- again absent, not an empty label. */
export const NoListings: Story = {
  args: {
    platforms: [],
    bloc: new StreamingPlatformsBloc({ flags: stubFlags(true) }),
  },
};

/** The centred variant the anime page hero uses below 768px. */
export const CentredOnMobile: Story = {
  args: {
    platforms: PLATFORMS,
    centerOnMobile: true,
    bloc: new StreamingPlatformsBloc({ flags: stubFlags(true) }),
  },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
