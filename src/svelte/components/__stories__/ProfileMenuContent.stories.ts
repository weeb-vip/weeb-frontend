import type { Meta, StoryObj } from '@storybook/svelte';
import ProfileMenuContent from '../ProfileMenuContent.svelte';
import {
  ProfileMenuContentBloc,
  type SessionPort,
  type SignOutServicePort,
} from '../ProfileMenuContent.bloc.svelte';

/** Signing out for real would clear cookies and navigate the Storybook frame. */
const noopService: SignOutServicePort = { signOut: async () => {} };
const noopSession: SessionPort = { clear: () => {} };

function stubBloc() {
  return new ProfileMenuContentBloc({
    service: noopService,
    session: noopSession,
    navigate: () => {},
  });
}

/** A sign-out that never resolves, so the pending state stays on screen. */
function pendingBloc() {
  const bloc = new ProfileMenuContentBloc({
    service: { signOut: () => new Promise<void>(() => {}) },
    session: noopSession,
    navigate: () => {},
  });
  void bloc.signOut();

  return bloc;
}

const user = {
  id: '1',
  username: 'sakura',
  firstname: 'Sakura',
  lastname: 'Kinomoto',
  email: 'sakura@example.com',
  profileImageUrl: null,
};

const meta = {
  title: 'Design System/ProfileMenuContent',
  component: ProfileMenuContent,
  tags: ['autodocs'],
} satisfies Meta<typeof ProfileMenuContent>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The desktop dropdown body: user card with email, links, sign out. */
export const Desktop: Story = {
  args: {
    user,
    isMobile: false,
    bloc: stubBloc(),
  },
};

/** The same menu inside the mobile drawer: bigger rows, icon font, no email line. */
export const Mobile: Story = {
  args: {
    user,
    isMobile: true,
    bloc: stubBloc(),
  },
};

/** No email on the account -- the third line is dropped rather than left blank. */
export const WithoutEmail: Story = {
  args: {
    user: { ...user, email: null },
    isMobile: false,
    bloc: stubBloc(),
  },
};

/** A name and address long enough to overflow: both truncate inside the 288px menu. */
export const LongName: Story = {
  args: {
    user: {
      ...user,
      username: 'the-longest-username-anyone-has-ever-registered-here',
      firstname: 'Bartholomew Maximilian',
      lastname: 'Featherstonehaugh-Wollstonecraft',
      email: 'bartholomew.featherstonehaugh@an-unusually-long-domain.example.com',
    },
    isMobile: false,
    bloc: stubBloc(),
  },
};

/** Mid sign-out: the button disables itself so the request cannot be fired twice. */
export const SigningOut: Story = {
  args: {
    user,
    isMobile: false,
    bloc: pendingBloc(),
  },
};
