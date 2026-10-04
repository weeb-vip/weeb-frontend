import type { Meta, StoryObj } from '@storybook/svelte';
import ActivityFeed from './ActivityFeed.svelte';
import type { ActivityItem } from './activity';

const items: ActivityItem[] = [
  { key: '1', actor: { id: 'u1', username: 'sakura', name: 'Sakura Kinomoto', profileImageUrl: null }, verb: 'finished watching', card: { id: 'a1', slug: 'cowboy-bebop', title: 'Cowboy Bebop', image: 'a1', imagePath: 'posters', onList: 'COMPLETED' }, occurredAt: '2026-10-03T11:00:00Z', when: '1h' },
  { key: '2', actor: { id: 'u2', username: 'tomoyo', name: 'Tomoyo', profileImageUrl: null }, verb: 'started reading', card: { id: 'w1', title: 'Berserk', image: 'w1', imagePath: 'works', href: '/manga/berserk', onList: 'READING' }, occurredAt: '2026-10-02T11:00:00Z', when: '1d' },
  { key: '3', actor: { id: 'u1', username: 'sakura', name: 'Sakura Kinomoto', profileImageUrl: null }, verb: 'scored 8.5', card: { id: 'a2', slug: 'mushishi', title: 'Mushishi', image: 'a2', imagePath: 'posters' }, occurredAt: '2026-09-30T11:00:00Z', when: '3d' },
];

const meta = {
  title: 'Composites/Feed/ActivityFeed',
  component: ActivityFeed,
  tags: ['autodocs'],
} satisfies Meta<typeof ActivityFeed>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithItems: Story = { args: { items } };
export const WithoutActor: Story = { args: { items, showActor: false } };
export const Empty: Story = { args: { items: [], empty: 'No list activity yet.' } };
