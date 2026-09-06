import { describe, it, expect, vi, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import { Language } from '../../../gql/graphql';
import { reactiveScope } from '../__tests__/reactive-scope.svelte';
import {
  ProfileSettingsBloc,
  type ProfileSettingsDeps,
  type ProfileSettingsPort
} from './ProfileSettings.bloc.svelte';

/**
 * The settings form. The interesting rule is that the form is the edits made
 * ON TOP of the server's row rather than a copy of it -- a copy had to be
 * re-synced on every query answer, so a refetch mid-edit overwrote the typing.
 */

const SERVER_USER = {
  firstname: 'Ada',
  lastname: 'Lovelace',
  username: 'ada',
  email: 'ada@example.com',
  language: Language.En,
  bio: 'Counting.',
  accentColor: 'violet',
  listsPublic: true
};

const ACCENTS = [
  { name: 'violet', label: 'Violet', color: 'oklch(60% 0.2 300)' },
  { name: 'green', label: 'Green', color: 'oklch(70% 0.2 150)' }
] as unknown as ProfileSettingsDeps['accents'];

/** A settings port seeded with a user, so the query answers on the first read. */
function settingsPort(
  user: Record<string, unknown> | null,
  save = vi.fn(async (input: unknown) => ({ ...user, ...(input as object) }))
): ProfileSettingsPort & { save: typeof save } {
  return {
    user: () => ({
      queryKey: ['user'],
      queryFn: async () => user,
      ...(user ? { initialData: user } : {})
    }),
    save
  };
}

function makeBloc(deps: Partial<ProfileSettingsDeps> = {}) {
  return new ProfileSettingsBloc({
    settings: settingsPort(SERVER_USER),
    accents: ACCENTS,
    confirmationMs: 20,
    queryClient: new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    }),
    ...deps
  });
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 1));

const scopes: (() => void)[] = [];
afterEach(() => {
  while (scopes.length) scopes.pop()!();
});

/** A GraphQL failure shaped the way the gateway actually sends one. */
const gqlError = (code: string | undefined, message: string) => ({
  response: { errors: [{ extensions: { code, message } }] }
});

describe('ProfileSettingsBloc', () => {
  describe('the form', () => {
    it('shows the server’s row before anything is edited', () => {
      const bloc = makeBloc();

      expect(bloc.hasUser).toBe(true);
      expect(bloc.form).toEqual(SERVER_USER);
      expect(bloc.bioLength).toBe(SERVER_USER.bio.length);
    });

    it('shows blanks while there is no user to render', () => {
      const bloc = makeBloc({ settings: settingsPort(null) });

      expect(bloc.hasUser).toBe(false);
      expect(bloc.form.username).toBe('');
      expect(bloc.form.language).toBe(Language.En);
      expect(bloc.form.listsPublic).toBe(false);
    });

    it('fills in the blanks a row left null', () => {
      const bloc = makeBloc({
        settings: settingsPort({ username: 'ada', firstname: null, bio: null, listsPublic: null })
      });

      expect(bloc.form.firstname).toBe('');
      expect(bloc.form.bio).toBe('');
      expect(bloc.form.listsPublic).toBe(false);
    });

    it('lays an edit over the server’s value', () => {
      const bloc = makeBloc();

      bloc.setField('username', 'ada-l');

      expect(bloc.form.username).toBe('ada-l');
      // Everything else still reads through to the server's row.
      expect(bloc.form.email).toBe(SERVER_USER.email);
    });

    it('holds an edit across a refetch that answers mid-edit', async () => {
      const bloc = makeBloc();
      scopes.push(reactiveScope(() => bloc.form));

      bloc.setField('bio', 'Half a sen');
      await settle();

      // The old copy-and-resync form lost the typing here.
      expect(bloc.form.bio).toBe('Half a sen');
    });

    it('counts the bio against the limit it publishes', () => {
      const bloc = makeBloc();

      bloc.setField('bio', 'x'.repeat(12));

      expect(bloc.bioLength).toBe(12);
      expect(bloc.bioLimit).toBe(300);
    });
  });

  describe('the accent swatches', () => {
    it('knows which one is selected', () => {
      const bloc = makeBloc();

      expect(bloc.isAccentSelected('violet')).toBe(true);
      expect(bloc.isAccentSelected('green')).toBe(false);
    });

    it('picks a new one', () => {
      const bloc = makeBloc();

      bloc.selectAccent('green');

      expect(bloc.isAccentSelected('green')).toBe(true);
      expect(bloc.isAccentSelected('violet')).toBe(false);
    });

    it('clears the colour when the chosen one is picked again', () => {
      const bloc = makeBloc();

      bloc.selectAccent('violet');

      // The swatches are a toggle.
      expect(bloc.form.accentColor).toBe('');
    });

    it('offers whichever palette it was handed', () => {
      expect(makeBloc().accents).toBe(ACCENTS);
    });
  });

  describe('the other fields', () => {
    it('changes the language', () => {
      const bloc = makeBloc();

      bloc.setLanguage(Language.Th);

      expect(bloc.form.language).toBe(Language.Th);
    });

    it('offers both languages the app has', () => {
      expect(makeBloc().languages.map((l) => l.value)).toEqual([Language.En, Language.Th]);
    });

    it('toggles the public-lists switch both ways', () => {
      const bloc = makeBloc();

      bloc.toggleListsPublic();
      expect(bloc.form.listsPublic).toBe(false);

      bloc.toggleListsPublic();
      expect(bloc.form.listsPublic).toBe(true);
    });
  });

  describe('saving', () => {
    it('saves nothing before the user has loaded, and says why', () => {
      const port = settingsPort(null);
      const bloc = makeBloc({ settings: port });

      bloc.submit();

      expect(port.save).not.toHaveBeenCalled();
      // Silence here was a bug: the form renders empty while the query is in
      // flight, so a click on a live-looking Save button did nothing at all
      // and looked identical to a save that worked.
      expect(bloc.errorMessage).toBe('Still loading your profile. Try again in a moment.');
    });

    it('cannot save until the user has loaded', () => {
      expect(makeBloc({ settings: settingsPort(null) }).canSave).toBe(false);
      expect(makeBloc({ settings: settingsPort(SERVER_USER) }).canSave).toBe(true);
    });

    it('requires a username, and says so on the field', () => {
      const port = settingsPort(SERVER_USER);
      const bloc = makeBloc({ settings: port });

      bloc.setField('username', '   ');
      bloc.submit();

      expect(bloc.usernameError).toBe('Username is required.');
      expect(port.save).not.toHaveBeenCalled();
    });

    it('does not require a name -- registration never collected one', async () => {
      const port = settingsPort({ ...SERVER_USER, firstname: '', lastname: '' });
      const bloc = makeBloc({ settings: port });

      bloc.setField('username', 'ada-l');
      bloc.submit();
      await settle();

      // Requiring them made them a roadblock in front of the one field the
      // account actually has.
      expect(port.save).toHaveBeenCalledTimes(1);
    });

    it('sends only the fields that actually moved', async () => {
      const port = settingsPort(SERVER_USER);
      const bloc = makeBloc({ settings: port });

      bloc.setField('bio', 'Still counting.');
      bloc.submit();
      await settle();

      expect(port.save).toHaveBeenCalledWith({ bio: 'Still counting.' });
    });

    it('sends a cleared field, rather than treating empty as unchanged', async () => {
      const port = settingsPort(SERVER_USER);
      const bloc = makeBloc({ settings: port });

      bloc.setField('bio', '');
      bloc.submit();
      await settle();

      expect(port.save).toHaveBeenCalledWith({ bio: '' });
    });

    it('sends a toggled switch and a cleared accent', async () => {
      const port = settingsPort(SERVER_USER);
      const bloc = makeBloc({ settings: port });

      bloc.toggleListsPublic();
      bloc.selectAccent('violet');
      bloc.submit();
      await settle();

      expect(port.save).toHaveBeenCalledWith({ listsPublic: false, accentColor: '' });
    });

    it('says so rather than writing when nothing moved', () => {
      const port = settingsPort(SERVER_USER);
      const bloc = makeBloc({ settings: port });

      bloc.submit();

      expect(port.save).not.toHaveBeenCalled();
      expect(bloc.successMessage).toBe('No changes to save.');
    });

    it('says so when an edit was typed back to what the server already has', () => {
      const port = settingsPort(SERVER_USER);
      const bloc = makeBloc({ settings: port });

      bloc.setField('username', 'ada-l');
      bloc.setField('username', 'ada');
      bloc.submit();

      expect(port.save).not.toHaveBeenCalled();
      expect(bloc.successMessage).toBe('No changes to save.');
    });

    it('confirms, and drops the edits, once the write lands', async () => {
      const bloc = makeBloc();

      bloc.setField('bio', 'Still counting.');
      bloc.submit();
      await settle();

      expect(bloc.successMessage).toBe('Profile updated successfully!');
      expect(bloc.errorMessage).toBe('');
    });

    it('takes the confirmation down after a while', async () => {
      const bloc = makeBloc({ confirmationMs: 5 });

      bloc.submit(); // "No changes to save."
      expect(bloc.successMessage).toBeTruthy();

      await new Promise((resolve) => setTimeout(resolve, 15));
      expect(bloc.successMessage).toBe('');
    });

    it('clears an old message the moment anything is edited again', async () => {
      const bloc = makeBloc();
      bloc.submit();
      expect(bloc.successMessage).toBeTruthy();

      bloc.setField('bio', 'x');

      expect(bloc.successMessage).toBe('');
    });
  });

  describe('when the save fails', () => {
    it('puts a username collision on the field, not in the page banner', async () => {
      const bloc = makeBloc({
        settings: settingsPort(
          SERVER_USER,
          vi.fn(async () => Promise.reject(gqlError('USERNAME_TAKEN', 'That name is taken.')))
        )
      });

      bloc.setField('username', 'ada-l');
      bloc.submit();
      await settle();

      expect(bloc.usernameError).toBe('That name is taken.');
      expect(bloc.errorMessage).toBe('');
    });

    it('has its own words for a collision that carried none', async () => {
      const bloc = makeBloc({
        settings: settingsPort(
          SERVER_USER,
          vi.fn(async () => Promise.reject(gqlError('USERNAME_TAKEN', '')))
        )
      });

      bloc.setField('username', 'ada-l');
      bloc.submit();
      await settle();

      expect(bloc.usernameError).toBe('That username is already taken.');
    });

    it('puts anything else in the page banner', async () => {
      const bloc = makeBloc({
        settings: settingsPort(
          SERVER_USER,
          vi.fn(async () => Promise.reject(gqlError('INTERNAL', 'Upstream is down.')))
        )
      });

      bloc.setField('bio', 'x');
      bloc.submit();
      await settle();

      expect(bloc.errorMessage).toBe('Upstream is down.');
      expect(bloc.usernameError).toBe('');
      expect(bloc.successMessage).toBe('');
    });

    it('has a fallback for a failure with no GraphQL shape at all', async () => {
      const bloc = makeBloc({
        settings: settingsPort(
          SERVER_USER,
          vi.fn(async () => Promise.reject(new Error('socket hang up')))
        )
      });

      bloc.setField('bio', 'x');
      bloc.submit();
      await settle();

      expect(bloc.errorMessage).toBe('Failed to update profile. Please try again.');
    });

    it('keeps the edits so they can be corrected and resubmitted', async () => {
      const bloc = makeBloc({
        settings: settingsPort(
          SERVER_USER,
          vi.fn(async () => Promise.reject(gqlError('USERNAME_TAKEN', 'taken')))
        )
      });

      bloc.setField('username', 'ada-l');
      bloc.submit();
      await settle();

      expect(bloc.form.username).toBe('ada-l');
    });

    it('clears the field error as soon as the username is edited again', async () => {
      const bloc = makeBloc({
        settings: settingsPort(
          SERVER_USER,
          vi.fn(async () => Promise.reject(gqlError('USERNAME_TAKEN', 'taken')))
        )
      });
      bloc.setField('username', 'ada-l');
      bloc.submit();
      await settle();

      bloc.setField('username', 'ada-lovelace');

      expect(bloc.usernameError).toBe('');
    });
  });
});
