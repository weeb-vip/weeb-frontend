import type { Meta, StoryObj } from '@storybook/svelte';
import { readable } from 'svelte/store';
import UserProfileWrapper from '../UserProfileWrapper.svelte';
import {
  UserProfileWrapperBloc,
  type AuthPort,
  type ProfileUser,
  type UserQueryPort,
} from '../UserProfileWrapper.bloc.svelte';

/**
 * The real bloc reaches for a QueryClient, the auth store and the mobile
 * drawer. Stubbing all three is what lets the four states be shown at once --
 * previously only one of them was reachable without logging in and out.
 */
function stubBloc(options: {
  isLoggedIn: boolean;
  data?: ProfileUser | null;
  isLoading?: boolean;
  isError?: boolean;
}) {
  const auth: AuthPort = readable({ isLoggedIn: options.isLoggedIn });
  const userQuery: UserQueryPort = readable({
    data: options.data ?? null,
    isLoading: options.isLoading ?? false,
    isError: options.isError ?? false,
  });

  return new UserProfileWrapperBloc({
    auth,
    userQuery,
    drawer: { open: () => {} },
    prompt: { requestLogin: () => {}, requestRegister: () => {} },
  });
}

const user: ProfileUser = {
  id: '1',
  username: 'sakura',
  firstname: 'Sakura',
  lastname: 'Kinomoto',
  email: 'sakura@example.com',
  profileImageUrl: null,
};

const meta = {
  title: 'Design System/UserProfileWrapper',
  component: UserProfileWrapper,
  tags: ['autodocs'],
} satisfies Meta<typeof UserProfileWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Signed out on desktop: the Login and Register pair. */
export const SignedOut: Story = {
  args: {
    bloc: stubBloc({ isLoggedIn: false }),
  },
};

/** Signed out on mobile: the hamburger that opens the drawer. */
export const SignedOutMobile: Story = {
  args: {
    isMobile: true,
    bloc: stubBloc({ isLoggedIn: false }),
  },
};

/** Signed in, user query still in flight: the pulsing skeleton. */
export const Loading: Story = {
  args: {
    bloc: stubBloc({ isLoggedIn: true, isLoading: true }),
  },
};

/** Signed in with a resolved user: the avatar and its dropdown. */
export const SignedIn: Story = {
  args: {
    bloc: stubBloc({ isLoggedIn: true, data: user }),
  },
};

/**
 * Signed in, user query failed. Any failure now produces a generic user rather
 * than nothing -- the old rule only accepted "Access denied" and left everyone
 * else looking at a skeleton that pulsed forever.
 */
export const QueryFailed: Story = {
  args: {
    bloc: stubBloc({ isLoggedIn: true, isError: true }),
  },
};

/** Signed in, settled, and still nobody: a still placeholder, deliberately not pulsing. */
export const Stuck: Story = {
  args: {
    bloc: stubBloc({ isLoggedIn: true, data: null }),
  },
};

/** Signed in on mobile: just the avatar, which opens the drawer. */
export const SignedInMobile: Story = {
  args: {
    isMobile: true,
    bloc: stubBloc({ isLoggedIn: true, data: user }),
  },
};
