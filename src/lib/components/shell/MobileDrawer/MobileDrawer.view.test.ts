import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { readable, writable } from 'svelte/store';
import type { TitleLanguage } from '$lib/stores/preferences';
import type { ProfileUser } from '$lib/components/profile/UserProfileWrapper';
import type { PreferencesPort } from '$lib/components/shell/TitleLanguageToggle';
import { stubWebAnimations } from '$lib/components/__tests__/jsdom-gaps';
import MobileDrawer from './MobileDrawer.svelte';
import {
  MobileDrawerBloc,
  type BodyScrollPort,
  type DrawerStatePort
} from './MobileDrawer.bloc.svelte';

/**
 * The drawer as it is drawn: what is in the panel, what a tap on each control
 * does, and that it is a real dialog rather than a div that happens to be on
 * top.
 *
 * Which links exist, what the active rule is, and the sign-out sequence are
 * decided in the bloc and asserted in `MobileDrawer.test.ts`. This file drives
 * the real bloc through in-memory ports and asserts the DOM that comes out.
 *
 * Two platform stand-ins are in play, both from `__tests__/jsdom-gaps`:
 * `stubWebAnimations`, because Svelte compiles the panel's `transition:fly`
 * into `element.animate()` and jsdom has no Web Animations API at all -- the
 * drawer could otherwise be opened but never closed; and, per test, a no-op
 * `BodyScrollPort` so the real page pin never freezes the jsdom document. What
 * the 280ms slide looks like is a browser fact and is left to the visual layer.
 */

/** The drawer store, in memory, recording that it was asked to close. */
function drawerPort(open = true) {
  const store = writable(open);
  const close = vi.fn(() => store.set(false));

  return { subscribe: store.subscribe, close } satisfies DrawerStatePort & {
    close: ReturnType<typeof vi.fn>;
  };
}

/** Never pins the real document -- see the note above. */
function scrollPort() {
  const lock = vi.fn();
  const unlock = vi.fn();

  return { lock, unlock } satisfies BodyScrollPort;
}

function preferencesPort(titleLanguage: TitleLanguage = 'english') {
  const store = writable<{ titleLanguage: TitleLanguage }>({ titleLanguage });
  const toggleTitleLanguage = vi.fn(() =>
    store.update(({ titleLanguage: current }) => ({
      titleLanguage: current === 'english' ? 'japanese' : 'english'
    }))
  );

  return Object.assign(store, { toggleTitleLanguage }) as PreferencesPort &
    typeof store & { toggleTitleLanguage: typeof toggleTitleLanguage };
}

const USER: ProfileUser = {
  id: '1',
  username: 'sakura',
  firstname: 'Sakura',
  lastname: 'Kinomoto',
  email: 'sakura@example.com',
  profileImageUrl: null
};

function makeBloc(
  options: {
    open?: boolean;
    isLoggedIn?: boolean;
    user?: ProfileUser | null;
    pathname?: string;
    titleLanguage?: TitleLanguage;
    drawer?: ReturnType<typeof drawerPort>;
    bodyScroll?: BodyScrollPort;
    preferences?: PreferencesPort;
    prompt?: { requestLogin: () => void; requestRegister: () => void };
    signOut?: () => Promise<void>;
    navigate?: (url: string) => void;
  } = {}
) {
  return new MobileDrawerBloc({
    drawer: options.drawer ?? drawerPort(options.open ?? true),
    auth: readable({ isLoggedIn: options.isLoggedIn ?? false }),
    userQuery: readable({ data: options.user ?? null }),
    preferences: options.preferences ?? preferencesPort(options.titleLanguage),
    route: readable(options.pathname ?? '/'),
    bodyScroll: options.bodyScroll ?? scrollPort(),
    prompt: options.prompt ?? { requestLogin: vi.fn(), requestRegister: vi.fn() },
    signOutService: { signOut: options.signOut ?? (async () => {}) },
    session: { clear: vi.fn() },
    navigate: options.navigate ?? vi.fn()
  });
}

const openDrawer = (options: Parameters<typeof makeBloc>[0] = {}) =>
  render(MobileDrawer, { props: { bloc: makeBloc(options) } });

/** The panel is portalled to <body>, so nothing is found through the container. */
const panel = () => screen.getByRole('dialog', { name: 'Menu' });

describe('MobileDrawer', () => {
  let restoreAnimations: () => void;
  beforeAll(() => {
    restoreAnimations = stubWebAnimations();
  });
  afterAll(() => restoreAnimations());

  describe('open and closed', () => {
    it('renders nothing at all while closed', () => {
      openDrawer({ open: false, isLoggedIn: true, user: USER });

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Home' })).not.toBeInTheDocument();
    });

    it('announces itself as a modal dialog, named, when open', () => {
      openDrawer();

      const dialog = panel();
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAccessibleName('Menu');
    });

    it('portals the surface to <body>, clear of whatever declared it', () => {
      const { container } = openDrawer();

      expect(container.contains(panel())).toBe(false);
      expect(document.body.contains(panel())).toBe(true);
    });
  });

  describe('the navigation', () => {
    it('lists the six sections, in order, in a named nav', () => {
      openDrawer();

      const nav = screen.getByRole('navigation', { name: 'Primary' });
      expect(within(nav).getAllByRole('link').map((link) => link.textContent?.trim())).toEqual([
        'Home',
        'Season',
        'Airing',
        'Browse',
        'Manga',
        'Light novels'
      ]);
    });

    it('points each row at its section, the season row at a season', () => {
      openDrawer();

      const nav = screen.getByRole('navigation', { name: 'Primary' });
      expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
      expect(within(nav).getByRole('link', { name: 'Airing' })).toHaveAttribute('href', '/airing');
      expect(within(nav).getByRole('link', { name: 'Browse' })).toHaveAttribute('href', '/search');
      expect(within(nav).getByRole('link', { name: 'Manga' })).toHaveAttribute('href', '/manga');
      expect(within(nav).getByRole('link', { name: 'Light novels' })).toHaveAttribute(
        'href',
        '/light-novels'
      );
      expect(within(nav).getByRole('link', { name: 'Season' }).getAttribute('href')).toMatch(
        /^\/season\/(WINTER|SPRING|SUMMER|FALL)_\d{4}$/
      );
    });

    /**
     * The drawer used to give no indication of where you were, while the
     * desktop header always has. A detail page keeps its section lit.
     */
    it('marks the section you are in, and only that one', () => {
      openDrawer({ pathname: '/manga/spice-and-wolf' });

      const nav = screen.getByRole('navigation', { name: 'Primary' });
      expect(within(nav).getByRole('link', { name: 'Manga' })).toHaveAttribute(
        'aria-current',
        'page'
      );
      for (const name of ['Home', 'Season', 'Airing', 'Browse', 'Light novels']) {
        expect(within(nav).getByRole('link', { name })).not.toHaveAttribute('aria-current');
      }
    });

    it('marks Home only on the home page', () => {
      openDrawer({ pathname: '/' });

      expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    });

    it('closes the drawer when a section is followed, so the panel does not sit over the new page', async () => {
      const drawer = drawerPort(true);
      openDrawer({ drawer });

      await userEvent.click(screen.getByRole('link', { name: 'Airing' }));

      expect(drawer.close).toHaveBeenCalled();
    });
  });

  describe('signed out', () => {
    it('offers Login and Register, and neither an account list nor a sign-out', () => {
      openDrawer({ isLoggedIn: false });

      expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Register' })).toBeInTheDocument();
      expect(screen.queryByText('Account')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Sign Out/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /My Profile/ })).not.toBeInTheDocument();
    });

    it('asks for the login modal and gets out of its way', async () => {
      const prompt = { requestLogin: vi.fn(), requestRegister: vi.fn() };
      const drawer = drawerPort(true);
      openDrawer({ isLoggedIn: false, prompt, drawer });

      await userEvent.click(screen.getByRole('button', { name: 'Login' }));

      expect(prompt.requestLogin).toHaveBeenCalledTimes(1);
      expect(drawer.close).toHaveBeenCalled();
    });

    it('does the same for register', async () => {
      const prompt = { requestLogin: vi.fn(), requestRegister: vi.fn() };
      openDrawer({ isLoggedIn: false, prompt });

      await userEvent.click(screen.getByRole('button', { name: 'Register' }));

      expect(prompt.requestRegister).toHaveBeenCalledTimes(1);
    });
  });

  describe('signed in', () => {
    it('puts the user card at the top, as the only route to the profile', () => {
      openDrawer({ isLoggedIn: true, user: USER });

      const card = screen.getByRole('link', { name: /sakura/ });
      expect(card).toHaveAttribute('href', '/profile');
      expect(within(card).getByText('sakura')).toBeInTheDocument();
      expect(within(card).getByText('Sakura Kinomoto')).toBeInTheDocument();
    });

    it('lists the account rows under their own heading', () => {
      openDrawer({ isLoggedIn: true, user: USER });

      expect(screen.getByText('Account')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'My List' })).toHaveAttribute(
        'href',
        '/profile/anime'
      );
      expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
      expect(screen.queryByRole('button', { name: 'Login' })).not.toBeInTheDocument();
    });

    /**
     * REGRESSION. The card is gated on being signed in, not on the user query
     * having answered -- a slow or failed query used to leave the drawer with
     * no route to the profile at all.
     */
    it('still offers a way to the profile while the user query has not answered', () => {
      openDrawer({ isLoggedIn: true, user: null });

      const card = screen.getByRole('link', { name: /My Profile/ });
      expect(card).toHaveAttribute('href', '/profile');
    });

    it('omits the second name line for a user who has none', () => {
      openDrawer({ isLoggedIn: true, user: { ...USER, firstname: '', lastname: '' } });

      expect(screen.getByRole('link', { name: /sakura/ })).toBeInTheDocument();
      expect(screen.queryByText('Sakura Kinomoto')).not.toBeInTheDocument();
    });

    it('reports and locks the sign-out while it is running', async () => {
      let finish: () => void = () => {};
      const signOut = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
      openDrawer({ isLoggedIn: true, user: USER, signOut });

      await userEvent.click(screen.getByRole('button', { name: 'Sign Out' }));

      const pending = await screen.findByRole('button', { name: 'Signing out…' });
      expect(pending).toBeDisabled();

      finish();
      await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    });
  });

  describe('preferences', () => {
    it('shows the code for the language in force', () => {
      openDrawer({ titleLanguage: 'japanese' });

      expect(screen.getByRole('button', { name: 'Toggle title language' })).toHaveTextContent('JP');
    });

    it('flips the language, and says so', async () => {
      const preferences = preferencesPort('english');
      openDrawer({ preferences });

      const toggle = screen.getByRole('button', { name: 'Toggle title language' });
      expect(toggle).toHaveTextContent('EN');

      await userEvent.click(toggle);

      expect(preferences.toggleTitleLanguage).toHaveBeenCalledTimes(1);
      expect(toggle).toHaveTextContent('JP');
    });
  });

  describe('the dialog machinery it shares with Modal', () => {
    it('closes from the named close control', async () => {
      const drawer = drawerPort(true);
      openDrawer({ drawer });

      await userEvent.click(screen.getByRole('button', { name: 'Close menu' }));

      expect(drawer.close).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    /**
     * Focus lands on the close button rather than the logo link above it: the
     * first thing a reader arriving in the panel wants is the way out.
     */
    it('moves focus into the panel on open', async () => {
      openDrawer();

      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Close menu' })).toHaveFocus()
      );
    });

    it('closes on Escape', async () => {
      const drawer = drawerPort(true);
      openDrawer({ drawer });

      await userEvent.keyboard('{Escape}');

      expect(drawer.close).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    /**
     * The pin is a port precisely so a test (or a story) can decline it. What
     * is asserted is that the drawer takes and gives back the lock it was
     * handed -- and that the real document was never touched, which is the
     * failure mode that would otherwise freeze every test after this one.
     */
    it('takes the page pin it was given on open and releases it on teardown', async () => {
      const bodyScroll = scrollPort();
      const { unmount } = openDrawer({ bodyScroll });

      expect(bodyScroll.lock).toHaveBeenCalledTimes(1);
      expect(document.body.style.position).toBe('');

      unmount();
      await waitFor(() => expect(bodyScroll.unlock).toHaveBeenCalledTimes(1));
      expect(document.body.style.position).toBe('');
    });
  });

  it('prints the build it is running', () => {
    openDrawer();

    expect(within(panel()).getByText(__APP_VERSION__)).toBeInTheDocument();
  });
});
