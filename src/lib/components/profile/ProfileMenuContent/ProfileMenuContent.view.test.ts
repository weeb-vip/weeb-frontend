import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import ProfileMenuContent from './ProfileMenuContent.svelte';
import {
  ProfileMenuContentBloc,
  type ProfileMenuContentDeps
} from './ProfileMenuContent.bloc.svelte';

/**
 * The profile menu's markup: the identity block, the three links and the
 * sign-out control -- drawn twice, once inside the desktop dropdown and once
 * inside the mobile drawer.
 *
 * The sign-out sequence itself (server call, local clear, redirect, the
 * failure path) is asserted against the bloc in `ProfileMenuContent.test.ts`.
 * What is asserted here is what a user sees and reaches: which of the two
 * presentations is on screen, that the rows go where they say they do, and
 * that the button reports and locks itself while the sign-out is in flight.
 *
 * jsdom caveat: the two presentations differ mostly in padding, type scale and
 * hover treatment, none of which exists here -- no stylesheet is loaded. The
 * differences asserted below are the structural ones (a link vs a div, an
 * extra line of identity), not the visual ones.
 */

const user = {
  id: 'u1',
  username: 'sakura',
  firstname: 'Sakura',
  lastname: 'Kinomoto',
  email: 'sakura@example.com',
  profileImageUrl: null
};

/** A bloc whose ports go nowhere, so a click cannot navigate or log out for real. */
function makeBloc(deps: Partial<ProfileMenuContentDeps> = {}) {
  return new ProfileMenuContentBloc({
    service: { signOut: vi.fn(async () => {}) },
    session: { clear: vi.fn() },
    navigate: vi.fn(),
    ...deps
  });
}

describe('ProfileMenuContent', () => {
  let errors: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => errors.mockRestore());

  describe('the desktop menu', () => {
    it('names the user, their full name and the address the account is under', () => {
      render(ProfileMenuContent, { props: { user, bloc: makeBloc() } });

      expect(screen.getByText('sakura')).toBeInTheDocument();
      expect(screen.getByText('Sakura Kinomoto')).toBeInTheDocument();
      expect(screen.getByText('sakura@example.com')).toBeInTheDocument();
    });

    it('leaves the identity block as a heading, not a fourth link', () => {
      render(ProfileMenuContent, { props: { user, bloc: makeBloc() } });

      // Three rows plus the sign-out button. The username is a label here; on
      // mobile the whole block becomes the link to /profile instead.
      expect(screen.getAllByRole('link')).toHaveLength(3);
      expect(screen.queryByRole('link', { name: /sakura@example.com/ })).not.toBeInTheDocument();
    });

    it('drops the email line for an account that has none', () => {
      render(ProfileMenuContent, {
        props: { user: { ...user, email: null }, bloc: makeBloc() }
      });

      expect(screen.getByText('sakura')).toBeInTheDocument();
      expect(screen.queryByText('sakura@example.com')).not.toBeInTheDocument();
    });
  });

  describe('the mobile menu', () => {
    /**
     * The drawer has no room for a separate profile row, so the identity block
     * itself is the link to /profile.
     */
    it('makes the whole identity block the link to the profile', () => {
      render(ProfileMenuContent, { props: { user, isMobile: true, bloc: makeBloc() } });

      const card = screen.getByRole('link', { name: /sakura/ });
      expect(card).toHaveAttribute('href', '/profile');
      expect(within(card).getByText('Sakura Kinomoto')).toBeInTheDocument();
    });

    it('does not repeat the email in the narrow panel', () => {
      render(ProfileMenuContent, { props: { user, isMobile: true, bloc: makeBloc() } });

      expect(screen.queryByText('sakura@example.com')).not.toBeInTheDocument();
    });
  });

  describe('the links, in both presentations', () => {
    for (const isMobile of [false, true]) {
      const where = isMobile ? 'mobile' : 'desktop';

      it(`offers View Profile, My List and Settings on ${where}`, () => {
        render(ProfileMenuContent, { props: { user, isMobile, bloc: makeBloc() } });

        expect(screen.getByRole('link', { name: 'View Profile' })).toHaveAttribute(
          'href',
          '/profile'
        );
        expect(screen.getByRole('link', { name: 'My List' })).toHaveAttribute(
          'href',
          '/profile/anime'
        );
        expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
      });

      it(`closes the surface hosting it when a row is followed on ${where}`, async () => {
        const onClose = vi.fn();
        render(ProfileMenuContent, { props: { user, isMobile, onClose, bloc: makeBloc() } });

        await userEvent.click(screen.getByRole('link', { name: 'Settings' }));

        expect(onClose).toHaveBeenCalledTimes(1);
      });
    }

    /**
     * REGRESSION. The row used to read "Watchlist", which named half of what
     * the page behind it holds -- nothing is watched on the manga side.
     */
    it('calls the list row "My List", matching the drawer and the page title', () => {
      render(ProfileMenuContent, { props: { user, bloc: makeBloc() } });

      expect(screen.queryByRole('link', { name: 'Watchlist' })).not.toBeInTheDocument();
    });
  });

  describe('signing out', () => {
    it('offers a sign-out button that is ready, not pending', () => {
      render(ProfileMenuContent, { props: { user, bloc: makeBloc() } });

      const button = screen.getByRole('button', { name: 'Sign Out' });
      expect(button).toBeEnabled();
    });

    /**
     * The double-fire guard, as it is perceived: while the server call is in
     * flight the control says so and cannot be pressed again. The bloc's own
     * "ignore the second call" rule is asserted in the bloc test; this is the
     * half a user can see.
     */
    it('reports and locks itself while the sign-out is in flight', async () => {
      let finish: () => void = () => {};
      const signOut = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
      render(ProfileMenuContent, { props: { user, bloc: makeBloc({ service: { signOut } }) } });

      await userEvent.click(screen.getByRole('button', { name: 'Sign Out' }));

      const pending = await screen.findByRole('button', { name: 'Signing out…' });
      expect(pending).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Sign Out' })).not.toBeInTheDocument();

      finish();
      await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    });

    it('closes the surface hosting it once the session is gone', async () => {
      const onClose = vi.fn();
      const navigate = vi.fn();
      render(ProfileMenuContent, {
        props: { user, onClose, bloc: makeBloc({ navigate }) }
      });

      await userEvent.click(screen.getByRole('button', { name: 'Sign Out' }));

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(navigate).toHaveBeenCalledWith('/');
    });

    /** A menu with no host surface must still sign out rather than throw. */
    it('signs out from a menu that was given nothing to close', async () => {
      const navigate = vi.fn();
      render(ProfileMenuContent, { props: { user, bloc: makeBloc({ navigate }) } });

      await userEvent.click(screen.getByRole('button', { name: 'Sign Out' }));

      await waitFor(() => expect(navigate).toHaveBeenCalledWith('/'));
    });
  });
});
