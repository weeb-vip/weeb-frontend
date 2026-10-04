import type { Meta, StoryObj } from '@storybook/svelte';
import { writable } from 'svelte/store';
import FollowButton from './FollowButton.svelte';
import { FollowButtonBloc, type FollowTarget } from './FollowButton.bloc.svelte';

const target = (status: FollowTarget['status']): FollowTarget => ({ userID: 'user_sakura', username: 'sakura', status, followApprovalRequired: false });

/** A bloc that never talks to the network: the click flips the state locally. */
const bloc = (status: FollowTarget['status']) =>
  new FollowButtonBloc({
    source: () => target(status),
    port: { follow: async () => 'FOLLOWING', unfollow: async () => true },
    auth: writable({ isLoggedIn: true }),
    prompt: { requireAuth: () => {} },
    notify: { error: () => {} },
  });

const meta = {
  title: 'Composites/Profile/FollowButton',
  component: FollowButton,
  tags: ['autodocs'],
} satisfies Meta<typeof FollowButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NotFollowing: Story = { args: { target: target('NONE'), bloc: bloc('NONE') } };
export const Following: Story = { args: { target: target('FOLLOWING'), bloc: bloc('FOLLOWING') } };
export const Requested: Story = { args: { target: target('REQUESTED'), bloc: bloc('REQUESTED') } };
