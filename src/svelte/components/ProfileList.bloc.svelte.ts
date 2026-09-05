import type { Medium } from './MediaList.bloc.svelte';

/**
 * One page, two media. This owns only the Anime | Manga switch above the status
 * tabs; each list below owns its own status, page and view.
 *
 * The medium lives in the URL (?medium=manga) so the choice survives a reload or
 * a shared link, the same way the status and page below it do.
 */

export interface MediumUrlPort {
  read(): Medium | null;
  write(medium: Medium): void;
  /** Back/forward. Returns its own teardown. */
  onChange(listener: () => void): () => void;
}

export const browserMediumUrl: MediumUrlPort = {
  read() {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('medium') === 'manga'
      ? 'manga'
      : 'anime';
  },
  write(medium) {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (medium === 'manga') url.searchParams.set('medium', 'manga');
    else url.searchParams.delete('medium');
    // Status and page belong to the other medium's tabs; drop them so the
    // incoming list opens on its own default rather than an alien status.
    url.searchParams.delete('status');
    url.searchParams.delete('page');
    window.history.pushState({}, '', url.toString());
  },
  onChange(listener) {
    if (typeof window === 'undefined') return () => {};
    window.addEventListener('popstate', listener);
    return () => window.removeEventListener('popstate', listener);
  },
};

/** What the view knows: the loader's payload, which names the resolved medium. */
export type ProfileListSource = () => { ssr: any | null };

export interface ProfileListDeps {
  source?: ProfileListSource;
  url?: MediumUrlPort;
}

export class ProfileListBloc {
  readonly tabs = [
    { value: 'anime', label: 'Anime' },
    { value: 'manga', label: 'Manga' },
  ];

  readonly #url: MediumUrlPort;
  #medium = $state<Medium>('anime');

  constructor({ source = () => ({ ssr: null }), url = browserMediumUrl }: ProfileListDeps = {}) {
    this.#url = url;
    // Seeded from the server's resolved medium so SSR renders the shelf the URL
    // actually names, rather than a default the client then swaps -- which is
    // the whole reason the data was fetched on the server.
    this.#medium = source().ssr?.medium === 'manga' ? 'manga' : 'anime';
  }

  get medium(): Medium {
    return this.#medium;
  }

  select(medium: string): void {
    const next: Medium = medium === 'manga' ? 'manga' : 'anime';
    if (next === this.#medium) return;
    this.#medium = next;
    this.#url.write(next);
  }

  /** Adopt the address on mount, then follow back/forward. */
  start(): () => void {
    const fromUrl = this.#url.read();
    if (fromUrl) this.#medium = fromUrl;
    return this.#url.onChange(() => {
      const medium = this.#url.read();
      if (medium) this.#medium = medium;
    });
  }
}
