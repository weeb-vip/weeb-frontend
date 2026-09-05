import { goto } from '$app/navigation';
import { page } from '$app/stores';
import { derived, fromStore, type Readable } from 'svelte/store';
import { loggedInStore } from '../stores/auth';
import { preferencesStore } from '../stores/preferences';
import { mobileDrawerOpen, closeMobileDrawer } from '../stores/mobileDrawer';
import {
  ProfileMenuContentBloc,
  type NavigatePort,
  type SessionPort,
  type SignOutServicePort
} from './ProfileMenuContent.bloc.svelte';
import {
  createUserQuery,
  realAuthPrompt,
  type AuthPort,
  type AuthPromptPort,
  type ProfileUser,
  type UserQueryPort
} from './UserProfileWrapper.bloc.svelte';
import type { PreferencesPort } from './TitleLanguageToggle.bloc.svelte';

export interface DrawerStatePort extends Readable<boolean> {
  close(): void;
}

/** The current path, which is all the drawer needs `page` for. */
export type RoutePort = Readable<string>;

/**
 * Pinning the page behind the drawer.
 *
 * `overflow: hidden` alone does not hold on iOS Safari -- the page keeps
 * scrolling under the drawer. Pinning the body and restoring the offset on
 * close is the only thing that works there, and it costs nothing elsewhere.
 *
 * A port because a story that renders the open drawer must not pin the
 * Storybook canvas.
 */
export interface BodyScrollPort {
  lock(): void;
  unlock(): void;
}

export function createBodyScrollLock(): BodyScrollPort {
  let savedScrollY = 0;
  let locked = false;

  return {
    lock() {
      if (typeof document === 'undefined' || locked) return;
      savedScrollY = window.scrollY;
      const b = document.body.style;
      b.position = 'fixed';
      b.top = `-${savedScrollY}px`;
      b.left = '0';
      b.right = '0';
      b.overflow = 'hidden';
      locked = true;
    },
    unlock() {
      if (typeof document === 'undefined' || !locked) return;
      const b = document.body.style;
      b.position = '';
      b.top = '';
      b.left = '';
      b.right = '';
      b.overflow = '';
      locked = false;
      window.scrollTo(0, savedScrollY);
    }
  };
}

export interface DrawerLink {
  href: string;
  label: string;
  icon: string;
}

function currentSeason(now: Date = new Date()): string {
  const month = now.getMonth();
  const year = now.getFullYear();
  if (month >= 0 && month <= 2) return `WINTER_${year}`;
  if (month >= 3 && month <= 5) return `SPRING_${year}`;
  if (month >= 6 && month <= 8) return `SUMMER_${year}`;
  return `FALL_${year}`;
}

/**
 * The drawer gave no indication of where you were, while the desktop header
 * has always marked the current item. Home matches exactly; everything else
 * matches by prefix so a detail page keeps its section lit.
 *
 * Pure and exported: the rule is the interesting part of the highlight.
 */
export function isActiveLink(href: string, pathname: string): boolean {
  const path = href.split('?')[0];
  if (path === '/') return pathname === '/';

  return pathname.startsWith(path);
}

export interface MobileDrawerDeps {
  drawer?: DrawerStatePort;
  auth?: AuthPort;
  userQuery?: UserQueryPort;
  preferences?: PreferencesPort;
  route?: RoutePort;
  bodyScroll?: BodyScrollPort;
  prompt?: AuthPromptPort;
  signOutService?: SignOutServicePort;
  session?: SessionPort;
  navigate?: NavigatePort;
}

/**
 * Everything the mobile drawer knows: whether it is open, who is signed in,
 * where you are, what the links are, and the page-scroll lock that comes with
 * being a modal surface. The view renders it and traps focus.
 */
export class MobileDrawerBloc {
  readonly #drawer: DrawerStatePort;
  readonly #isOpen: { current: boolean };
  readonly #auth: { current: { isLoggedIn: boolean } };
  readonly #query: { current: { data?: ProfileUser | null } };
  readonly #preferences: PreferencesPort;
  readonly #prefsState: { current: { titleLanguage: string } };
  readonly #route: { current: string };
  readonly #bodyScroll: BodyScrollPort;
  readonly #prompt: AuthPromptPort;
  readonly #signOut: ProfileMenuContentBloc;

  constructor({
    drawer = { subscribe: mobileDrawerOpen.subscribe, close: closeMobileDrawer },
    auth = loggedInStore,
    userQuery = createUserQuery(),
    preferences = preferencesStore,
    route = derived(page, ($page) => $page.url.pathname),
    bodyScroll = createBodyScrollLock(),
    prompt = realAuthPrompt,
    signOutService,
    session,
    navigate = goto
  }: MobileDrawerDeps = {}) {
    this.#drawer = drawer;
    this.#isOpen = fromStore(drawer);
    this.#auth = fromStore(auth);
    this.#query = fromStore(userQuery);
    this.#preferences = preferences;
    this.#prefsState = fromStore(preferences);
    this.#route = fromStore(route);
    this.#bodyScroll = bodyScroll;
    this.#prompt = prompt;
    // The same sign-out sequence the desktop profile menu runs, not a second
    // copy of it. Undefined deps fall through to that bloc's real ports.
    this.#signOut = new ProfileMenuContentBloc({
      ...(signOutService ? { service: signOutService } : {}),
      ...(session ? { session } : {}),
      navigate
    });
  }

  get isOpen(): boolean {
    return this.#isOpen.current;
  }

  get isLoggedIn(): boolean {
    return this.#auth.current?.isLoggedIn ?? false;
  }

  get user(): ProfileUser | null {
    return this.#query.current?.data ?? null;
  }

  /** Falls back to a generic label so a slow or failed user query still links out. */
  get displayName(): string {
    return this.user?.username || 'My Profile';
  }

  get fullName(): string {
    const parts = [this.user?.firstname, this.user?.lastname].filter(Boolean);
    return parts.join(' ');
  }

  get languageLabel(): string {
    return this.#prefsState.current?.titleLanguage === 'english' ? 'EN' : 'JP';
  }

  get pathname(): string {
    return this.#route.current ?? '/';
  }

  get isSigningOut(): boolean {
    return this.#signOut.isSigningOut;
  }

  get navLinks(): DrawerLink[] {
    // The season link is the only one that depends on today; computed on the
    // client only so the server and the first client render agree.
    const season = typeof window !== 'undefined' ? currentSeason() : 'SPRING_2026';

    return [
      { href: '/', label: 'Home', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
      { href: `/season/${season}`, label: 'Season', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
      { href: '/airing', label: 'Airing', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
      { href: '/search', label: 'Browse', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
      { href: '/manga', label: 'Manga', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
      { href: '/light-novels', label: 'Light novels', icon: 'M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 016.5 22H20v-5M4 19.5V4.5A2.5 2.5 0 016.5 2H20v15' }
    ];
  }

  /**
   * No "My Profile" row: the user card at the top of the drawer is the link to
   * /profile, and a second one a row below it was the same destination twice.
   *
   * "My List", not "My Anime List" or the desktop menu's "Watchlist": the page
   * behind it is one list with an Anime | Manga switch, and both of the old
   * names picked a side. Nothing is watched on the manga half. One row rather
   * than two, because two would be two links to the same page with different
   * ?medium= params, and whichever sat second would read as the lesser of the
   * pair -- which is the thing the peer switcher on the page exists to avoid.
   */
  get userLinks(): DrawerLink[] {
    return [
      { href: '/profile/anime', label: 'My List', icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z' },
      { href: '/settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' }
    ];
  }

  isActive(href: string): boolean {
    return isActiveLink(href, this.pathname);
  }

  close(): void {
    this.#drawer.close();
  }

  /** Escape only closes something that is open. */
  handleEscape(): void {
    if (this.isOpen) this.close();
  }

  toggleTitleLanguage(): void {
    this.#preferences.toggleTitleLanguage();
  }

  requestLogin(): void {
    this.close();
    this.#prompt.requestLogin();
  }

  requestRegister(): void {
    this.close();
    this.#prompt.requestRegister();
  }

  signOut(): Promise<void> {
    return this.#signOut.signOut(() => this.close());
  }

  /** Called by the view whenever `isOpen` changes, and on teardown. */
  syncBodyScroll(): void {
    if (this.isOpen) {
      this.#bodyScroll.lock();
    } else {
      this.#bodyScroll.unlock();
    }
  }

  releaseBodyScroll(): void {
    this.#bodyScroll.unlock();
  }
}
