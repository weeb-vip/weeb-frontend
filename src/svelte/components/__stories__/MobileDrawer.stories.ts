import type { Meta, StoryObj } from '@storybook/svelte';
import { readable, writable } from 'svelte/store';
import MobileDrawer from '../MobileDrawer.svelte';
import {
  MobileDrawerBloc,
  type BodyScrollPort,
  type DrawerStatePort,
} from '../MobileDrawer.bloc.svelte';
import type { ProfileUser } from '../UserProfileWrapper.bloc.svelte';
import type { TitleLanguage } from '../../stores/preferences';

/** Pinning the real page would freeze the Storybook canvas behind the panel. */
const noBodyLock: BodyScrollPort = { lock: () => {}, unlock: () => {} };

function stubDrawerState(open: boolean): DrawerStatePort {
  const { subscribe, set } = writable(open);

  return { subscribe, close: () => set(false) };
}

function stubBloc(options: {
  open?: boolean;
  isLoggedIn: boolean;
  user?: ProfileUser | null;
  pathname?: string;
  titleLanguage?: TitleLanguage;
}) {
  return new MobileDrawerBloc({
    drawer: stubDrawerState(options.open ?? true),
    auth: readable({ isLoggedIn: options.isLoggedIn }),
    userQuery: readable({ data: options.user ?? null }),
    preferences: {
      subscribe: readable({ titleLanguage: options.titleLanguage ?? 'english' }).subscribe,
      toggleTitleLanguage: () => {},
    },
    route: readable(options.pathname ?? '/'),
    bodyScroll: noBodyLock,
    prompt: { requestLogin: () => {}, requestRegister: () => {} },
    signOutService: { signOut: async () => {} },
    session: { clear: () => {} },
    navigate: () => {},
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
  title: 'Composites/App Shell/MobileDrawer',
  component: MobileDrawer,
  tags: ['autodocs'],
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
} satisfies Meta<typeof MobileDrawer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Signed out: nav, the Login/Register pair directly under it, no account section. */
export const SignedOut: Story = {
  args: {
    bloc: stubBloc({ isLoggedIn: false }),
  },
};

/** Signed in with a resolved user: the profile card, the Account list and Sign out. */
export const SignedIn: Story = {
  args: {
    bloc: stubBloc({ isLoggedIn: true, user }),
  },
};

/**
 * Signed in but the user query has not answered. The card is gated on being
 * signed in, not on the query, so there is still a route to the profile.
 */
export const SignedInWithoutUser: Story = {
  args: {
    bloc: stubBloc({ isLoggedIn: true, user: null }),
  },
};

/** On /manga: the current section is marked, matching the desktop header. */
export const CurrentSectionMarked: Story = {
  args: {
    bloc: stubBloc({ isLoggedIn: true, user, pathname: '/manga/spice-and-wolf' }),
  },
};

/** Japanese titles selected, so the preferences chip reads JP. */
export const JapaneseTitles: Story = {
  args: {
    bloc: stubBloc({ isLoggedIn: true, user, titleLanguage: 'japanese' }),
  },
};

/** A name long enough to overflow the 320px panel; both lines ellipsise. */
export const LongName: Story = {
  args: {
    bloc: stubBloc({
      isLoggedIn: true,
      user: {
        ...user,
        username: 'the-longest-username-anyone-has-ever-registered-here',
        firstname: 'Bartholomew Maximilian',
        lastname: 'Featherstonehaugh-Wollstonecraft',
      },
    }),
  },
};

/** Closed: the drawer renders nothing at all. */
export const Closed: Story = {
  args: {
    bloc: stubBloc({ open: false, isLoggedIn: true, user }),
  },
};
