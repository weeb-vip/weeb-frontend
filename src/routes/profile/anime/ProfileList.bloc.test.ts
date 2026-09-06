import { describe, it, expect, vi, afterEach } from 'vitest';
import { ProfileListBloc, browserMediumUrl, type MediumUrlPort } from './ProfileList.bloc.svelte';

/**
 * The Anime | Manga switch above /profile/anime.
 *
 * This bloc owns exactly one value -- which medium is showing -- and it lives in
 * three places at once: the loader's resolved payload (which decided what SSR
 * rendered), the address bar, and the class field the tabs bind to. The rules
 * worth pinning are the ones that keep those three from disagreeing: the seed
 * comes from the server so hydration does not swap the shelf out from under the
 * markup, an unchanged selection writes no history entry, and nothing anywhere
 * is allowed to leave a value from the previous medium behind.
 */

/** The URL port as three spies, so every write and subscription is observable. */
function urlPort(read: () => 'anime' | 'manga' | null = () => null) {
  const teardown = vi.fn();
  const port = {
    read: vi.fn(read),
    write: vi.fn(),
    onChange: vi.fn((_listener: () => void) => teardown),
  };
  return { port: port as unknown as MediumUrlPort & typeof port, teardown };
}

function bloc(ssr: any = null, url = urlPort().port) {
  return new ProfileListBloc({ source: () => ({ ssr }), url });
}

describe('the tab list', () => {
  it('offers exactly the two media, in the order the page renders them', () => {
    expect(bloc().tabs).toEqual([
      { value: 'anime', label: 'Anime' },
      { value: 'manga', label: 'Manga' },
    ]);
  });
});

describe('seeding from the loader payload', () => {
  it('opens on the medium the server actually resolved and fetched', () => {
    // The whole point of the server load: SSR rendered the manga shelf, so the
    // client must not start on anime and refetch its way back.
    expect(bloc({ medium: 'manga' }).medium).toBe('manga');
  });

  it('opens on anime when the payload names anime', () => {
    expect(bloc({ medium: 'anime' }).medium).toBe('anime');
  });

  it('opens on anime when there is no payload at all', () => {
    expect(bloc(null).medium).toBe('anime');
    expect(new ProfileListBloc({ url: urlPort().port }).medium).toBe('anime');
  });

  it('opens on anime for a payload that names something else', () => {
    // Only the literal string "manga" switches; a typo is not a third medium.
    expect(bloc({ medium: 'MANGA' }).medium).toBe('anime');
    expect(bloc({ medium: 'manwha' }).medium).toBe('anime');
    expect(bloc({ medium: null }).medium).toBe('anime');
    expect(bloc({}).medium).toBe('anime');
  });

  it('does not consult the URL while constructing', () => {
    // Reading the address is `start()`'s job, which only runs in the browser.
    // Doing it here would make the constructor unusable during SSR.
    const { port } = urlPort(() => 'manga');
    bloc({ medium: 'anime' }, port);

    expect(port.read).not.toHaveBeenCalled();
  });

  it('does not write the address it was seeded from', () => {
    const { port } = urlPort();
    bloc({ medium: 'manga' }, port);

    expect(port.write).not.toHaveBeenCalled();
  });

  it('is seeded once, so a later payload does not move the tab under the user', () => {
    let ssr: any = { medium: 'anime' };
    const bound = new ProfileListBloc({ source: () => ({ ssr }), url: urlPort().port });
    ssr = { medium: 'manga' };

    expect(bound.medium).toBe('anime');
  });
});

describe('select', () => {
  it('switches the medium and puts it in the address', () => {
    const { port } = urlPort();
    const bound = bloc({ medium: 'anime' }, port);

    bound.select('manga');

    expect(bound.medium).toBe('manga');
    expect(port.write).toHaveBeenCalledWith('manga');
  });

  it('switches back without leaving the previous medium behind anywhere', () => {
    const { port } = urlPort();
    const bound = bloc({ medium: 'anime' }, port);

    bound.select('manga');
    bound.select('anime');

    expect(bound.medium).toBe('anime');
    expect(port.write).toHaveBeenNthCalledWith(2, 'anime');
    expect(port.write).toHaveBeenCalledTimes(2);
  });

  it('is a no-op when the medium is already showing', () => {
    // Re-clicking the active tab is not a navigation; writing would push a
    // history entry that goes nowhere and reset the list's status and page.
    const { port } = urlPort();
    const bound = bloc({ medium: 'manga' }, port);

    bound.select('manga');

    expect(bound.medium).toBe('manga');
    expect(port.write).not.toHaveBeenCalled();
  });

  it('normalises anything that is not "manga" to anime, and writes that', () => {
    const { port } = urlPort();
    const bound = bloc({ medium: 'manga' }, port);

    bound.select('Manga');

    // The port is told the resolved medium, never the raw string, so the URL
    // can never hold a value `read()` would not give back.
    expect(bound.medium).toBe('anime');
    expect(port.write).toHaveBeenCalledWith('anime');
  });

  it('treats an empty selection as anime', () => {
    const { port } = urlPort();
    const bound = bloc({ medium: 'manga' }, port);

    bound.select('');

    expect(bound.medium).toBe('anime');
  });
});

describe('start', () => {
  it('adopts the address on mount, over the seed', () => {
    // A client-side navigation can land here with a payload from the previous
    // visit; the address is the newer of the two.
    const { port } = urlPort(() => 'manga');
    const bound = bloc({ medium: 'anime' }, port);

    bound.start();

    expect(bound.medium).toBe('manga');
  });

  it('does not write back the address it just read', () => {
    const { port } = urlPort(() => 'manga');
    const bound = bloc({ medium: 'anime' }, port);

    bound.start();

    expect(port.write).not.toHaveBeenCalled();
  });

  it('keeps the seed when the port has no address to give', () => {
    // The SSR port returns null; the seed is the only thing that knows.
    const { port } = urlPort(() => null);
    const bound = bloc({ medium: 'manga' }, port);

    bound.start();

    expect(bound.medium).toBe('manga');
  });

  it('follows back and forward through the port listener', () => {
    let current: 'anime' | 'manga' | null = 'anime';
    const { port } = urlPort(() => current);
    const bound = bloc({ medium: 'anime' }, port);
    bound.start();

    const listener = port.onChange.mock.calls[0][0] as () => void;
    current = 'manga';
    listener();

    expect(bound.medium).toBe('manga');
  });

  it('does not write while following history', () => {
    // Writing on popstate would push a new entry and trap the back button.
    let current: 'anime' | 'manga' | null = 'anime';
    const { port } = urlPort(() => current);
    const bound = bloc({ medium: 'anime' }, port);
    bound.start();

    current = 'manga';
    (port.onChange.mock.calls[0][0] as () => void)();

    expect(port.write).not.toHaveBeenCalled();
  });

  it('leaves the medium alone when a history entry names none', () => {
    let current: 'anime' | 'manga' | null = 'manga';
    const { port } = urlPort(() => current);
    const bound = bloc({ medium: 'anime' }, port);
    bound.start();
    expect(bound.medium).toBe('manga');

    current = null;
    (port.onChange.mock.calls[0][0] as () => void)();

    expect(bound.medium).toBe('manga');
  });

  it('hands back the port teardown, so the listener is removed on unmount', () => {
    const { port, teardown } = urlPort(() => 'anime');
    const bound = bloc(null, port);

    const stop = bound.start();
    expect(teardown).not.toHaveBeenCalled();
    stop();

    expect(teardown).toHaveBeenCalledTimes(1);
  });
});

describe('browserMediumUrl', () => {
  const original = '/profile/anime';

  afterEach(() => {
    window.history.replaceState({}, '', original);
  });

  const go = (search: string) => window.history.replaceState({}, '', `/profile/anime${search}`);
  const params = () => new URLSearchParams(window.location.search);

  it('reads manga only from the exact parameter value', () => {
    go('?medium=manga');
    expect(browserMediumUrl.read()).toBe('manga');

    go('?medium=Manga');
    expect(browserMediumUrl.read()).toBe('anime');
  });

  it('reads anime for an address that names no medium', () => {
    go('');
    expect(browserMediumUrl.read()).toBe('anime');
  });

  it('writes manga as a parameter and anime as its absence', () => {
    // Anime is the default shelf, so its canonical address is the short one.
    go('');
    browserMediumUrl.write('manga');
    expect(params().get('medium')).toBe('manga');

    browserMediumUrl.write('anime');
    expect(params().has('medium')).toBe(false);
  });

  it('drops the status and page belonging to the medium being left', () => {
    // READING is not a status the anime tabs have; carrying it across would
    // open the incoming list on a shelf that does not exist for it.
    go('?medium=manga&status=READING&page=3');

    browserMediumUrl.write('anime');

    expect(params().has('status')).toBe(false);
    expect(params().has('page')).toBe(false);
    expect(params().has('medium')).toBe(false);
  });

  it('drops them switching the other way too', () => {
    go('?status=PLANTOWATCH&page=2');

    browserMediumUrl.write('manga');

    expect(params().get('medium')).toBe('manga');
    expect(params().has('status')).toBe(false);
    expect(params().has('page')).toBe(false);
  });

  it('leaves parameters it does not own alone', () => {
    go('?utm_source=twitter&status=WATCHING');

    browserMediumUrl.write('manga');

    expect(params().get('utm_source')).toBe('twitter');
  });

  it('subscribes to popstate and unsubscribes through the teardown', () => {
    const listener = vi.fn();
    const stop = browserMediumUrl.onChange(listener);

    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(listener).toHaveBeenCalledTimes(1);

    stop();
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('drives the bloc end to end against the real address', () => {
    go('?medium=manga');
    const bound = new ProfileListBloc({
      source: () => ({ ssr: { medium: 'anime' } }),
      url: browserMediumUrl,
    });

    const stop = bound.start();
    expect(bound.medium).toBe('manga');

    bound.select('anime');
    expect(new URLSearchParams(window.location.search).has('medium')).toBe(false);
    stop();
  });
});
