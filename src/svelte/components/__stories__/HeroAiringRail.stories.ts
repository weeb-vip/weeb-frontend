import type { Meta, StoryObj } from '@storybook/svelte';
import HeroAiringRail from '../HeroAiringRail.svelte';
import StoryContainer from './StoryContainer.svelte';

/**
 * Entries arrive shaped by HomepageSSR.processCurrentlyAiring: the anime, plus
 * the one EpisodeTiming resolved there. The rail formats none of it itself.
 */
function entry(
  id: string,
  titleEn: string,
  timing: Record<string, unknown> | null,
  episodeNumber: number | null = 1
) {
  return {
    anime: { id, titleEn, slug: titleEn.toLowerCase().replace(/\W+/g, '-'), imageUrl: '' },
    airingInfo: {
      timing,
      nextEpisode: episodeNumber === null ? null : { episodeNumber },
    },
  };
}

const meta = {
  title: 'Design System/HeroAiringRail',
  component: HeroAiringRail,
  tags: ['autodocs'],
  decorators: [
    () => ({
      Component: StoryContainer,
      props: { width: '420px' },
    }),
  ],
} satisfies Meta<typeof HeroAiringRail>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A normal schedule: one show live, the rest counting down. */
export const Default: Story = {
  args: {
    entries: [
      entry('1', 'Sousou no Frieren', { isLive: true, countdown: 'AIRING NOW', localTime: '11:00 PM' }, 24),
      entry('2', 'One Punch Man Season 3', { isLive: false, hasAired: false, countdown: '45m', localTime: '1:05 AM' }, 6),
      entry('3', 'Jujutsu Kaisen Season 3', { isLive: false, hasAired: false, countdown: '15h', localTime: '11:56 PM' }, 2),
      entry('4', 'Kaijuu 8-gou Season 2', { isLive: false, hasAired: true, countdown: '', localTime: '11:00 PM' }, 8),
    ],
    activeId: '1',
  },
};

/** Beyond a day out there is no countdown, so the rail prints whole days. */
export const DaysAway: Story = {
  args: {
    entries: [
      entry(
        '5',
        'Chainsaw Man Season 2',
        {
          isLive: false,
          hasAired: false,
          countdown: '',
          airDateTime: new Date(Date.now() + 3 * 86400000).toISOString(),
          localTime: '12:30 AM',
        },
        1
      ),
    ],
    activeId: null,
  },
};

/** More entries than the rail shows: it takes the first eight and stops. */
export const OverLimit: Story = {
  args: {
    entries: Array.from({ length: 12 }, (_, index) =>
      entry(`${index + 10}`, `Airing Show Number ${index + 1}`, {
        isLive: false,
        hasAired: false,
        countdown: `${index + 1}h`,
        localTime: '9:00 PM',
      }, index + 1)
    ),
    activeId: '12',
  },
};

/** No timing resolved at all: the row still lists the show, with no when. */
export const WithoutTiming: Story = {
  args: {
    entries: [entry('6', 'A Show With No Schedule', null, null)],
    activeId: null,
  },
};

/** Nothing airing: the rail renders nothing rather than an empty panel. */
export const Empty: Story = {
  args: {
    entries: [],
    activeId: null,
  },
};
