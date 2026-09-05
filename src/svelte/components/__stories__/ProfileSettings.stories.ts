import type { Meta, StoryObj } from '@storybook/svelte';
import ProfileSettings from '../../../routes/profile/settings/+page.svelte';
import { ProfileSettingsBloc, type ProfileSettingsPort } from '../ProfileSettings.bloc.svelte';
import { Language } from '../../../gql/graphql';
import { freshClient } from './profileFixtures';

/** The settings form, with the user row and the save both stubbed. */

const USER = {
  firstname: 'That',
  lastname: 'Cat',
  username: 'thatcat',
  email: 'cat@example.com',
  language: Language.En,
  bio: 'Watching too much, reading more.',
  accentColor: 'cyan',
  listsPublic: true,
};

type Shape = 'ok' | 'never' | 'taken' | 'fails' | 'saving';

function settings(shape: Shape): ProfileSettingsPort {
  return {
    user: () => ({
      queryKey: ['stub-settings-user', shape],
      queryFn: async () => {
        if (shape === 'never') return new Promise(() => {});
        return USER;
      },
      // Resolved from the first frame, so a story can act on the form -- type a
      // username, submit it -- without waiting on a promise it also stubbed.
      initialData: shape === 'never' ? undefined : USER,
    }),
    save: async () => {
      if (shape === 'saving') return new Promise(() => {});
      if (shape === 'taken') {
        throw {
          response: {
            errors: [{ extensions: { code: 'USERNAME_TAKEN', message: 'That username is already taken.' } }],
          },
        };
      }
      if (shape === 'fails') throw new Error('gateway timeout');
      return USER;
    },
  };
}

function bloc(shape: Shape) {
  return new ProfileSettingsBloc({ settings: settings(shape), queryClient: freshClient() });
}

const meta = {
  title: 'Composites/Profile/ProfileSettings',
  component: ProfileSettings,
  tags: ['autodocs'],
} satisfies Meta<typeof ProfileSettings>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The form as it loads for an existing account. */
export const Populated: Story = {
  args: { bloc: bloc('ok') },
};

/** Waiting on the account: the form's own shape, in skeleton. */
export const Loading: Story = {
  args: { bloc: bloc('never') },
};

/** Saved. The confirmation is the same banner the failures use, in green. */
export const Saved: Story = {
  args: {
    bloc: (() => {
      const settings = bloc('ok');
      settings.setField('bio', 'A fresh line about me.');
      settings.submit();
      return settings;
    })(),
  },
};

/** The name was taken. That belongs on the field, not in the page banner. */
export const UsernameTaken: Story = {
  args: {
    bloc: (() => {
      const settings = bloc('taken');
      settings.setField('username', 'admin');
      settings.submit();
      return settings;
    })(),
  },
};

/** The save failed for a reason the form cannot fix: the error banner. */
export const SaveFailed: Story = {
  args: {
    bloc: (() => {
      const settings = bloc('fails');
      settings.setField('firstname', 'Someone');
      settings.submit();
      return settings;
    })(),
  },
};

/** Nothing changed, so the form says so rather than making a pointless write. */
export const NothingToSave: Story = {
  args: {
    bloc: (() => {
      const settings = bloc('ok');
      settings.submit();
      return settings;
    })(),
  },
};
