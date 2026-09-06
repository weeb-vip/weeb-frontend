import { describe, it, expect, vi } from 'vitest';
import { readable, writable } from 'svelte/store';
import type { ProfileUser } from '$lib/components/profile/UserProfileWrapper';
import {
  MobileDrawerBloc,
  isActiveLink,
  type DrawerStatePort,
  type MobileDrawerDeps
} from './MobileDrawer.bloc.svelte';

/** The drawer store, in memory. */
function drawerPort(open = false) {
  const store = writable(open);
  return Object.assign(store, { close: vi.fn(() => store.set(false)) }) as DrawerStatePort & {
    close: ReturnType<typeof vi.fn>;
  };
}

/** A ProfileUser with only the fields a case cares about set. */
const user_ = (fields: Partial<ProfileUser>): ProfileUser => ({
  id: 'u1',
  username: '',
  firstname: '',
  lastname: '',
  ...fields
});

function makeBloc(deps: Partial<MobileDrawerDeps> = {}) {
  return new MobileDrawerBloc({
    drawer: drawerPort(),
    auth: readable({ isLoggedIn: false }),
    userQuery: readable({}),
    preferences: Object.assign(readable({ titleLanguage: 'english' as const }), {
      toggleTitleLanguage: vi.fn()
    }),
    route: readable('/'),
    bodyScroll: { lock: vi.fn(), unlock: vi.fn() },
    prompt: { requestLogin: vi.fn(), requestRegister: vi.fn() },
    signOutService: { signOut: vi.fn(async () => {}) },
    session: { clear: vi.fn() },
    navigate: vi.fn(),
    ...deps
  } as MobileDrawerDeps);
}

describe('isActiveLink', () => {
  it('lights home only on home', () => {
    expect(isActiveLink('/', '/')).toBe(true);
    expect(isActiveLink('/', '/search')).toBe(false);
  });

  it('keeps a section lit on its detail pages', () => {
    expect(isActiveLink('/manga', '/manga/berserk')).toBe(true);
    expect(isActiveLink('/manga', '/light-novels')).toBe(false);
  });

  it('ignores the query string, so the season link still matches', () => {
    expect(isActiveLink('/season/FALL_2024?x=1', '/season/FALL_2024')).toBe(true);
  });

  it('matches a link that carries only a query', () => {
    expect(isActiveLink('/?tab=all', '/')).toBe(true);
  });
});

describe('MobileDrawerBloc', () => {
  describe('whether it is open', () => {
    it('reads the drawer store', () => {
      expect(makeBloc({ drawer: drawerPort(false) }).isOpen).toBe(false);
      expect(makeBloc({ drawer: drawerPort(true) }).isOpen).toBe(true);
    });

    it('closes through the store rather than holding its own flag', () => {
      const drawer = drawerPort(true);
      const bloc = makeBloc({ drawer });

      bloc.close();

      expect(drawer.close).toHaveBeenCalledTimes(1);
      expect(bloc.isOpen).toBe(false);
    });
  });

  describe('who is signed in', () => {
    it('reads the auth store, and copes with it having nothing yet', () => {
      expect(makeBloc({ auth: readable({ isLoggedIn: true }) }).isLoggedIn).toBe(true);
      expect(makeBloc({ auth: readable(undefined as never) }).isLoggedIn).toBe(false);
    });

    it('shows the user the query returned', () => {
      const user = user_({ username: 'ada', firstname: 'Ada', lastname: 'Lovelace' });

      expect(makeBloc({ userQuery: readable({ data: user }) }).user).toEqual(user);
      expect(makeBloc({ userQuery: readable({ data: null }) }).user).toBeNull();
    });

    it('still links out under a generic label when the query is slow or failed', () => {
      expect(makeBloc({ userQuery: readable({}) }).displayName).toBe('My Profile');
      expect(
        makeBloc({ userQuery: readable({ data: user_({ username: 'ada' }) }) }).displayName
      ).toBe('ada');
    });

    it('joins whichever name parts exist, and shows nothing for none', () => {
      expect(
        makeBloc({
          userQuery: readable({ data: user_({ firstname: 'Ada', lastname: 'Lovelace' }) })
        }).fullName
      ).toBe('Ada Lovelace');
      expect(
        makeBloc({ userQuery: readable({ data: user_({ firstname: 'Ada' }) }) }).fullName
      ).toBe('Ada');
      expect(
        makeBloc({ userQuery: readable({ data: user_({ username: 'ada' }) }) }).fullName
      ).toBe('');
    });
  });

  describe('the links', () => {
    it('lists the six sections, in order', () => {
      const links = makeBloc().navLinks;

      expect(links.map((l) => l.label)).toEqual([
        'Home',
        'Season',
        'Airing',
        'Browse',
        'Manga',
        'Light novels'
      ]);
      expect(links.every((l) => l.href && l.icon)).toBe(true);
    });

    it('links the season row to a season', () => {
      expect(makeBloc().navLinks[1].href).toMatch(
        /^\/season\/(WINTER|SPRING|SUMMER|FALL)_\d{4}$/
      );
    });

    it('offers one list row, not two links to the same page', () => {
      const links = makeBloc().userLinks;

      // "My List": the page behind it is one list with an Anime | Manga switch,
      // and both of the old names picked a side.
      expect(links.map((l) => l.label)).toEqual(['My List', 'Settings']);
      expect(links[0].href).toBe('/profile/anime');
    });

    it('has no "My Profile" row -- the user card above it is that link', () => {
      expect(makeBloc().userLinks.some((l) => l.href === '/profile')).toBe(false);
    });

    it('marks where you are', () => {
      const bloc = makeBloc({ route: readable('/manga/berserk') });

      expect(bloc.pathname).toBe('/manga/berserk');
      expect(bloc.isActive('/manga')).toBe(true);
      expect(bloc.isActive('/')).toBe(false);
    });

    it('reads as home when the route store has nothing', () => {
      expect(makeBloc({ route: readable(undefined as unknown as string) }).pathname).toBe('/');
    });
  });

  describe('the language toggle', () => {
    it('shows the code for the current language', () => {
      expect(makeBloc().languageLabel).toBe('EN');
      expect(
        makeBloc({
          preferences: Object.assign(readable({ titleLanguage: 'japanese' as const }), {
            toggleTitleLanguage: vi.fn()
          })
        }).languageLabel
      ).toBe('JP');
    });

    it('forwards the toggle to the preferences store', () => {
      const toggleTitleLanguage = vi.fn();
      const bloc = makeBloc({
        preferences: Object.assign(readable({ titleLanguage: 'english' as const }), {
          toggleTitleLanguage
        })
      });

      bloc.toggleTitleLanguage();

      expect(toggleTitleLanguage).toHaveBeenCalledTimes(1);
    });
  });

  describe('the auth prompts', () => {
    it('closes the drawer before asking for the login modal', () => {
      const drawer = drawerPort(true);
      const prompt = { requestLogin: vi.fn(), requestRegister: vi.fn() };
      const bloc = makeBloc({ drawer, prompt });

      bloc.requestLogin();

      expect(drawer.close).toHaveBeenCalledTimes(1);
      expect(prompt.requestLogin).toHaveBeenCalledTimes(1);
    });

    it('does the same for register', () => {
      const drawer = drawerPort(true);
      const prompt = { requestLogin: vi.fn(), requestRegister: vi.fn() };
      const bloc = makeBloc({ drawer, prompt });

      bloc.requestRegister();

      expect(drawer.close).toHaveBeenCalledTimes(1);
      expect(prompt.requestRegister).toHaveBeenCalledTimes(1);
    });
  });

  describe('signing out', () => {
    it('runs the same sequence the desktop menu runs, then closes the drawer', async () => {
      const order: string[] = [];
      const drawer = drawerPort(true);
      drawer.close.mockImplementation(() => order.push('close'));
      const bloc = makeBloc({
        drawer,
        signOutService: { signOut: vi.fn(async () => void order.push('server')) },
        session: { clear: vi.fn(() => order.push('client')) },
        navigate: vi.fn(() => order.push('navigate'))
      });

      await bloc.signOut();

      expect(order).toEqual(['server', 'client', 'close', 'navigate']);
    });

    it('reports while it is running', async () => {
      let release!: () => void;
      const bloc = makeBloc({
        signOutService: { signOut: vi.fn(() => new Promise<void>((r) => (release = r))) }
      });

      const inFlight = bloc.signOut();
      expect(bloc.isSigningOut).toBe(true);

      release();
      await inFlight;
      expect(bloc.isSigningOut).toBe(false);
    });
  });

  it('owns which page-scroll lock is used, and hands it to the dialog action', () => {
    const bodyScroll = { lock: vi.fn(), unlock: vi.fn() };

    // A story that renders the open drawer must not pin the Storybook canvas.
    expect(makeBloc({ bodyScroll }).scrollLock).toBe(bodyScroll);
  });
});
