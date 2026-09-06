/**
 * The settings page as rendered, rather than as a bloc.
 *
 * This file exists because of `tests/e2e/profile-username.spec.ts`, which is
 * marked `test.fail()` over "/profile/settings never populates". The diagnosis
 * recorded there — "the user query never delivers, so `hasUser` stays false" —
 * cannot be what happened, and the reason is a property of this template that
 * only a render test can pin: the whole form, the `<h1>`, the accent swatches
 * and the lists switch live inside `{:else if bloc.hasUser}`, with no `{:else}`
 * after it. A query that never delivers renders *nothing at all* — not an empty
 * form. The CI evidence describes an empty form that accepted typing, so the
 * query had delivered and `hasUser` was true.
 *
 * What follows pins both halves of that: what a delivered row renders, what an
 * undelivered one renders, and the behaviour of the row that actually explains
 * the e2e failure — one that arrives with an empty username.
 *
 * `$app/stores` is stubbed because `Seo` reads `$page.url` and SvelteKit's own
 * store needs an app context no unit test has.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { QueryClient } from '@tanstack/svelte-query';

const { page } = vi.hoisted(() => {
  const value = { url: new URL('https://weeb.vip/profile/settings') };
  return {
    page: {
      subscribe(notify: (v: typeof value) => void) {
        notify(value);
        return () => {};
      }
    }
  };
});
vi.mock('$app/stores', () => ({ page }));

const SettingsPage = (await import('./+page.svelte')).default;
const { ProfileSettingsBloc } = await import('$lib/components/profile/ProfileSettings.bloc.svelte');

const FULL_USER = {
  firstname: 'Ada',
  lastname: 'Lovelace',
  username: 'ada',
  email: 'ada@example.com',
  bio: 'Counting.',
  accentColor: 'violet',
  listsPublic: true
};

function makeBloc(user: Record<string, unknown> | null, save = vi.fn(async () => ({}))) {
  return new ProfileSettingsBloc({
    settings: {
      user: () => ({
        queryKey: ['user'],
        queryFn: async () => user,
        ...(user ? { initialData: user } : {})
      }),
      save
    },
    confirmationMs: 20,
    queryClient: new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    })
  });
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 1));

describe('/profile/settings', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });

  it('renders the form, populated, once the user query has delivered', () => {
    render(SettingsPage, { props: { bloc: makeBloc(FULL_USER) } });

    expect(screen.getByRole('heading', { level: 1, name: 'Profile Settings' })).toBeInTheDocument();
    expect((document.getElementById('username') as HTMLInputElement).value).toBe('ada');
    expect((document.getElementById('email') as HTMLInputElement).value).toBe('ada@example.com');
  });

  /**
   * The load-bearing one. There is no `{:else}`, so a query that has settled
   * without a row paints an empty page — no form, no error, no retry. It is
   * therefore impossible for a *failed* user query to produce the symptom the
   * e2e spec describes (fields present, typing accepted, two of them blank).
   */
  it('renders nothing at all — not an empty form — when no row arrives', async () => {
    const { container } = render(SettingsPage, { props: { bloc: makeBloc(null) } });
    await settle();

    expect(screen.queryByRole('heading', { level: 1, name: 'Profile Settings' })).toBeNull();
    expect(document.getElementById('username')).toBeNull();
    expect(document.getElementById('firstname')).toBeNull();
    expect(container.textContent?.trim()).toBe('');
  });

  describe('a row that arrives with an empty username', () => {
    /**
     * This is the shape that reproduces the e2e failure exactly: the form is
     * there and takes edits, the two server-sourced fields read blank, and Save
     * sends no mutation at all — so a `waitForResponse` on UpdateUserDetails can
     * only time out. Nothing about the query failed.
     */
    const BLANK_IDENTITY = { ...FULL_USER, username: '', email: '' };

    it('still renders the whole form and accepts edits', async () => {
      render(SettingsPage, { props: { bloc: makeBloc(BLANK_IDENTITY) } });

      expect(screen.getByRole('heading', { level: 1, name: 'Profile Settings' })).toBeInTheDocument();
      expect((document.getElementById('username') as HTMLInputElement).value).toBe('');
      expect((document.getElementById('email') as HTMLInputElement).value).toBe('');

      const firstname = document.getElementById('firstname') as HTMLInputElement;
      await fireEvent.input(firstname, { target: { value: 'Testy' } });
      expect((document.getElementById('firstname') as HTMLInputElement).value).toBe('Testy');
    });

    /**
     * And this is why no request is made, which is subtler than the bloc's own
     * `submit()` guard: `#username` is `required`, so the browser's constraint
     * validation refuses the form before the submit handler ever runs. Nothing
     * in the app is reached — no mutation, and no message of the app's own
     * either. A `waitForResponse` on UpdateUserDetails can only time out.
     */
    it('is blocked by the browser before the submit handler even runs', async () => {
      const save = vi.fn(async () => ({}));
      render(SettingsPage, { props: { bloc: makeBloc(BLANK_IDENTITY, save) } });

      await fireEvent.input(document.getElementById('firstname') as HTMLInputElement, {
        target: { value: 'Testy' }
      });
      await fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
      await settle();

      const username = document.getElementById('username') as HTMLInputElement;
      expect(username.required).toBe(true);
      expect(username.checkValidity()).toBe(false);
      expect(save).not.toHaveBeenCalled();
      // Not even the bloc's own "Username is required." — it never got the event.
      expect(document.getElementById('username-error')).toBeNull();
    });

    it('saves as soon as the username is filled in', async () => {
      const save = vi.fn(async () => ({ ...BLANK_IDENTITY, username: 'ada' }));
      render(SettingsPage, { props: { bloc: makeBloc(BLANK_IDENTITY, save) } });

      await fireEvent.input(document.getElementById('username') as HTMLInputElement, {
        target: { value: 'ada' }
      });
      await fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
      await settle();

      expect(save).toHaveBeenCalledWith({ username: 'ada' });
    });
  });
});
