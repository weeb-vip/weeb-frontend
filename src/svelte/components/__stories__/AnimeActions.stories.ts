import type { Meta, StoryObj } from '@storybook/svelte';
import { readable, writable } from 'svelte/store';
import AnimeActions from '../AnimeActions.svelte';
import {
  AnimeActionsBloc,
  type MutationStore,
  type MutationsPort,
} from '../AnimeActions.bloc.svelte';
import type { TitleLanguage } from '../../stores/preferences';

/**
 * A TanStack mutation, as this component uses one. The real pair reach the
 * network and the query client; here they only report what they were asked to
 * do and whether they are busy.
 */
function stubMutation(isPending = false): MutationStore {
  return readable({
    isPending,
    mutate: (variables: any) => console.log('mutate', variables),
  });
}

function stubMutations(isPending = false): MutationsPort {
  return { add: () => stubMutation(isPending), remove: () => stubMutation(isPending) };
}

function stubPreferences(titleLanguage: TitleLanguage = 'english') {
  return writable({ titleLanguage });
}

const anime = {
  id: '154587',
  titleEn: 'Frieren: Beyond Journey\'s End',
  titleJp: '葬送のフリーレン',
};

function bloc(options: {
  inList?: boolean;
  loggedIn?: boolean;
  authInitialized?: boolean;
  pending?: boolean;
} = {}) {
  const { inList = false, loggedIn = true, authInitialized = true, pending = false } = options;
  return new AnimeActionsBloc(
    {
      anime: inList
        ? { ...anime, userAnime: { id: 'user-anime-1', status: 'WATCHING' } }
        : anime,
    },
    {
      mutations: stubMutations(pending),
      auth: writable({ isLoggedIn: loggedIn, isAuthInitialized: authInitialized }),
      preferences: stubPreferences(),
      loginPrompt: {
        requireAuth: (options) => console.log('requireAuth', options.reason),
      },
    }
  );
}

const meta = {
  title: 'Design System/AnimeActions',
  component: AnimeActions,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof AnimeActions>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Not on the list: one button, whose whole job is to put it there. */
export const NotInList: Story = {
  args: { anime, bloc: bloc() },
};

/** Already tracked, so the control becomes the status dropdown instead. */
export const InList: Story = {
  args: { anime, bloc: bloc({ inList: true }) },
};

/** The mutation is in flight; `Button` shows its spinner. */
export const Saving: Story = {
  args: { anime, bloc: bloc({ pending: true }) },
};

/**
 * Signed out, with auth resolved: pressing Add opens the login modal carrying
 * the reason, rather than firing a mutation that can only be rejected.
 */
export const SignedOut: Story = {
  args: { anime, bloc: bloc({ loggedIn: false }) },
};

/**
 * Auth has not resolved yet. A returning visitor reads as signed-out here, so
 * the gate deliberately does not fire.
 */
export const AuthPending: Story = {
  args: { anime, bloc: bloc({ loggedIn: false, authInitialized: false }) },
};

/** The 32px round button used on cards. */
export const IconOnly: Story = {
  args: { anime, variant: 'icon-only', bloc: bloc() },
};

/** The banner variant, drawn for a dark photographic ground. */
export const Hero: Story = {
  args: { anime, variant: 'hero', bloc: bloc() },
};

/** The list-row variant. */
export const Compact: Story = {
  args: { anime, variant: 'compact', bloc: bloc() },
};
