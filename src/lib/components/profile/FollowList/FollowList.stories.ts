import type { Meta, StoryObj } from '@storybook/svelte';
import FollowList from './FollowList.svelte';

const users = [
  { id: 'u1', username: 'sakura', firstname: 'Sakura', lastname: 'Kinomoto', profileImageUrl: null, viewerFollowStatus: 'FOLLOWING' },
  { id: 'u2', username: 'tomoyo', profileImageUrl: null, viewerFollowStatus: 'NONE' },
  { id: 'u3', username: 'kero', profileImageUrl: null, viewerFollowStatus: 'REQUESTED' },
];

const meta = {
  title: 'Composites/Profile/FollowList',
  component: FollowList,
  tags: ['autodocs'],
} satisfies Meta<typeof FollowList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OnePage: Story = { args: { users, total: 3, page: 1, limit: 30, baseHref: '/u/sakura/followers', empty: 'Nobody yet.' } };
export const Paged: Story = { args: { users, total: 70, page: 2, limit: 30, baseHref: '/u/sakura/followers', empty: 'Nobody yet.' } };
export const Hidden: Story = { args: { users: [], total: 5, page: 1, limit: 30, baseHref: '/u/sakura/followers', empty: 'Nobody yet.', hidden: true } };
export const Empty: Story = { args: { users: [], total: 0, page: 1, limit: 30, baseHref: '/u/sakura/following', empty: "sakura isn't following anyone yet." } };
