import type { Meta, StoryObj } from '@storybook/svelte';
import ShowSchedulePanel from '../ShowSchedulePanel.svelte';

const meta = {
  title: 'Show/ShowSchedulePanel',
  component: ShowSchedulePanel,
  tags: ['autodocs'],
} satisfies Meta<typeof ShowSchedulePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

const base = {
  label: 'Next episode',
  countdown: '3h',
  episodeNumber: '12',
  localTime: 'Fri 6:00 AM',
  localZone: 'PST',
  broadcastSlot: 'Fridays at 23:00 (JST)',
  open: false,
  onToggle: () => {},
  onClose: () => {},
};

/** Something is coming, and the countdown says how soon. */
export const Upcoming: Story = { args: base };

/** Mid-broadcast: the countdown becomes what is left of the episode. */
export const AiringNow: Story = {
  args: { ...base, label: 'Airing now', countdown: '12m left' },
};

/** Just finished — there is nothing to count down to, so nothing is counted. */
export const RecentlyAired: Story = {
  args: { ...base, label: 'Recently aired', countdown: '' },
};

/** Further out than a day: the date is all the panel can honestly offer. */
export const FurtherOut: Story = {
  args: { ...base, countdown: '', localTime: 'Fri 6:00 AM' },
};

/** The broadcast-slot popover open, showing the original Japanese slot. */
export const BroadcastSlotOpen: Story = {
  args: { ...base, open: true },
};

/** A show whose slot the API never recorded: no toggle at all. */
export const NoBroadcastSlot: Story = {
  args: { ...base, broadcastSlot: null },
};
