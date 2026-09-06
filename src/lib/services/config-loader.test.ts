import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { IConfig } from '../../config/interfaces';

/**
 * The config loader is a module-level cache with two entirely separate paths:
 * the SSR one (no `window`, fetches an absolute URL off localhost with a
 * production fallback) and the client one (prefers whatever the root layout
 * hydrated into `configStore`, otherwise fetches `/config.json` once).
 *
 * Both paths and the cache live in module scope, so every test re-imports the
 * real module through `vi.resetModules()`. `fetch` is a `vi.fn()`; nothing
 * leaves the process.
 */

const CONFIG = {
  api_host: 'https://api.test.invalid',
  graphql_host: 'https://gateway.test.invalid/graphql',
  algolia_index: 'anime-test',
  cdn_url: 'https://cdn.test.invalid',
  cdn_user_url: 'https://cdn.test.invalid'
} as unknown as IConfig;

const mockConfigStore = vi.hoisted(() => ({
  get: vi.fn<() => IConfig | null>(() => null),
  hydrate: vi.fn(),
  init: vi.fn(),
  setConfig: vi.fn(),
  subscribe: vi.fn()
}));

vi.mock('$lib/stores/config', () => ({ configStore: mockConfigStore }));

let fetchMock: ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: vi.fn(async () => body)
  };
}

async function loadModule() {
  vi.resetModules();
  return import('./config-loader');
}

describe('config-loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigStore.get.mockReturnValue(null);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('client path', () => {
    it('prefers the config the layout already hydrated and never fetches', async () => {
      mockConfigStore.get.mockReturnValue(CONFIG);
      const { ensureConfigLoaded } = await loadModule();

      await expect(ensureConfigLoaded()).resolves.toEqual(CONFIG);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('mirrors the hydrated config onto the legacy window globals', async () => {
      mockConfigStore.get.mockReturnValue(CONFIG);
      const { ensureConfigLoaded } = await loadModule();

      await ensureConfigLoaded();

      expect((window as any).config).toEqual(CONFIG);
      expect((window as any).global.config).toEqual(CONFIG);
    });

    it('falls back to fetching /config.json when nothing hydrated the store', async () => {
      fetchMock.mockResolvedValue(jsonResponse(CONFIG));
      const { ensureConfigLoaded } = await loadModule();

      await expect(ensureConfigLoaded()).resolves.toEqual(CONFIG);
      expect(fetchMock).toHaveBeenCalledWith('/config.json');
      expect((window as any).config).toEqual(CONFIG);
    });

    it('caches the fetched config: a second call does not hit the network', async () => {
      fetchMock.mockResolvedValue(jsonResponse(CONFIG));
      const { ensureConfigLoaded } = await loadModule();

      await ensureConfigLoaded();
      await ensureConfigLoaded();

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('shares one in-flight request between concurrent callers', async () => {
      let release: (value: unknown) => void = () => {};
      fetchMock.mockReturnValue(
        new Promise((resolve) => {
          release = resolve;
        })
      );
      const { ensureConfigLoaded } = await loadModule();

      const a = ensureConfigLoaded();
      const b = ensureConfigLoaded();
      release(jsonResponse(CONFIG));

      expect(await a).toEqual(CONFIG);
      expect(await b).toEqual(CONFIG);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('rejects with the status when /config.json answers non-2xx', async () => {
      fetchMock.mockResolvedValue(jsonResponse(null, false, 503));
      const { ensureConfigLoaded } = await loadModule();

      await expect(ensureConfigLoaded()).rejects.toThrow('Failed to fetch config: 503');
    });

    it('propagates a rejected fetch', async () => {
      fetchMock.mockRejectedValue(new Error('offline'));
      const { ensureConfigLoaded } = await loadModule();

      await expect(ensureConfigLoaded()).rejects.toThrow('offline');
    });

    it('propagates a malformed payload that will not parse as JSON', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn(async () => {
          throw new SyntaxError('Unexpected token < in JSON at position 0');
        })
      });
      const { ensureConfigLoaded } = await loadModule();

      await expect(ensureConfigLoaded()).rejects.toThrow(/Unexpected token/);
    });

    it('accepts a JSON body that is not a config object (no shape validation)', async () => {
      // Documented, not endorsed: whatever /config.json returns is cached and
      // handed to every caller, so a 200 serving an SPA fallback HTML-as-JSON
      // or `null` becomes "the config" and fails later at the use site.
      fetchMock.mockResolvedValue(jsonResponse({ nonsense: true }));
      const { ensureConfigLoaded, isConfigLoaded } = await loadModule();

      await expect(ensureConfigLoaded()).resolves.toEqual({ nonsense: true });
      expect(isConfigLoaded()).toBe(true);
    });

    it('never retries after a failed fetch: the rejection is cached for the session', async () => {
      // FINDING (behaviour, not a crash): `configPromise` is assigned before the
      // request settles and is never cleared on failure, so one transient blip
      // on /config.json leaves every later caller with the same rejection until
      // a full page load. Asserted here so a change to it is a deliberate one.
      fetchMock.mockRejectedValue(new Error('transient blip'));
      const { ensureConfigLoaded } = await loadModule();

      await expect(ensureConfigLoaded()).rejects.toThrow('transient blip');

      fetchMock.mockResolvedValue(jsonResponse(CONFIG));
      await expect(ensureConfigLoaded()).rejects.toThrow('transient blip');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('SSR path', () => {
    beforeEach(() => {
      // `typeof window === 'undefined'` is the only thing the module branches
      // on, and a stubbed-undefined global satisfies it.
      vi.stubGlobal('window', undefined);
    });

    it('fetches the self-served config over an absolute URL', async () => {
      fetchMock.mockResolvedValue(jsonResponse(CONFIG));
      const { ensureConfigLoaded } = await loadModule();

      await expect(ensureConfigLoaded()).resolves.toEqual(CONFIG);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(String(fetchMock.mock.calls[0][0])).toMatch(/^https?:\/\/.+\/config\.json$/);
      expect((globalThis as any).config).toEqual(CONFIG);
    });

    it('retries against the origin fallback when the first URL fails', async () => {
      fetchMock
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce(jsonResponse(CONFIG));
      const { ensureConfigLoaded } = await loadModule();

      await expect(ensureConfigLoaded()).resolves.toEqual(CONFIG);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(String(fetchMock.mock.calls[1][0])).toContain('/config.json');
    });

    it('treats a non-2xx first response as a failure and falls back', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(null, false, 404))
        .mockResolvedValueOnce(jsonResponse(CONFIG));
      const { ensureConfigLoaded } = await loadModule();

      await expect(ensureConfigLoaded()).resolves.toEqual(CONFIG);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('throws when the fallback is non-2xx too', async () => {
      fetchMock
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce(jsonResponse(null, false, 500));
      const { ensureConfigLoaded } = await loadModule();

      await expect(ensureConfigLoaded()).rejects.toThrow('Failed to fetch config: 500');
    });

    it('throws when both attempts reject', async () => {
      fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
      const { ensureConfigLoaded } = await loadModule();

      await expect(ensureConfigLoaded()).rejects.toThrow('ECONNREFUSED');
    });

    it('propagates a malformed payload', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn(async () => {
          throw new SyntaxError('bad json');
        })
      });
      const { ensureConfigLoaded } = await loadModule();

      await expect(ensureConfigLoaded()).rejects.toThrow('bad json');
    });

    it('caches across calls so a route load does not refetch per page', async () => {
      fetchMock.mockResolvedValue(jsonResponse(CONFIG));
      const { ensureConfigLoaded } = await loadModule();

      await ensureConfigLoaded();
      await ensureConfigLoaded();

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('does retry after a failure, unlike the client path', async () => {
      // The SSR path stores no promise, so a failed request is retried on the
      // next request instead of poisoning the module. Worth pinning as the
      // counterpart to the client-path finding above.
      fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
      const { ensureConfigLoaded } = await loadModule();

      await expect(ensureConfigLoaded()).rejects.toThrow('ECONNREFUSED');

      fetchMock.mockReset();
      fetchMock.mockResolvedValue(jsonResponse(CONFIG));
      await expect(ensureConfigLoaded()).resolves.toEqual(CONFIG);
    });
  });

  describe('synchronous accessors', () => {
    it('getConfigSync throws before anything is loaded', async () => {
      const { getConfigSync } = await loadModule();

      expect(() => getConfigSync()).toThrow(
        'Config not loaded. Call ensureConfigLoaded() first.'
      );
    });

    it('getConfigSync returns the cached config afterwards', async () => {
      mockConfigStore.get.mockReturnValue(CONFIG);
      const { ensureConfigLoaded, getConfigSync } = await loadModule();

      await ensureConfigLoaded();

      expect(getConfigSync()).toEqual(CONFIG);
    });

    it('isConfigLoaded reports the cache state', async () => {
      mockConfigStore.get.mockReturnValue(CONFIG);
      const { ensureConfigLoaded, isConfigLoaded } = await loadModule();

      expect(isConfigLoaded()).toBe(false);
      await ensureConfigLoaded();
      expect(isConfigLoaded()).toBe(true);
    });
  });
});
