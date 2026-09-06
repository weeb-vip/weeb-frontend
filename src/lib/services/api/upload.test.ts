import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { uploadProfileImage, uploadBannerImage } from './upload';

/**
 * The two image uploads are the only place the app hand-builds a GraphQL
 * multipart request (graphql-request does not do file uploads), so what is
 * worth pinning is the request shape -- operations/map/0, in that order, with
 * no Content-Type of our own -- and every branch of the response handling.
 *
 * `fetch` is a `vi.fn()`, so nothing leaves the process. `withSpan` is left
 * real: without a registered tracer provider the OTel API hands back a no-op
 * span, so it is a pass-through here and mocking it would only hide it.
 */

const GRAPHQL_HOST = 'https://gateway.test.invalid/graphql';

const mockDebug = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
  auth: vi.fn(),
  anime: vi.fn()
}));

vi.mock('$lib/utils/debug', () => ({ __esModule: true, default: mockDebug }));

/** Minimal stand-in for the parts of Response that upload.ts actually reads. */
function response(init: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  json?: unknown;
  text?: string;
}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? 'OK',
    json: vi.fn(async () => init.json),
    text: vi.fn(async () => init.text ?? '')
  };
}

function pngFile(name = 'avatar.png') {
  return new File([new Uint8Array([1, 2, 3, 4])], name, { type: 'image/png' });
}

let fetchMock: ReturnType<typeof vi.fn>;

/** The FormData the module handed to fetch on its most recent call. */
function sentForm(): FormData {
  return fetchMock.mock.calls[0][1].body as FormData;
}

function sentOperations(): any {
  return JSON.parse(sentForm().get('operations') as string);
}

describe('image uploads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    // upload.ts reads `global.config.graphql_host`, the legacy global the
    // config loader also populates.
    (globalThis as any).global = (globalThis as any).global ?? globalThis;
    (globalThis as any).global.config = { graphql_host: GRAPHQL_HOST };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('uploadProfileImage', () => {
    it('posts a GraphQL multipart request to the configured host', async () => {
      fetchMock.mockResolvedValue(
        response({ json: { data: { UploadProfileImage: { id: 'u1' } } } })
      );

      await uploadProfileImage(pngFile());

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(GRAPHQL_HOST);
      expect(init.method).toBe('POST');
      expect(init.credentials).toBe('include');
      expect(init.body).toBeInstanceOf(FormData);
      // The boundary has to come from the browser; setting Content-Type
      // ourselves would produce a request the server cannot parse.
      expect(init.headers).toBeUndefined();
    });

    it('names the operation and leaves a null placeholder for the file', async () => {
      fetchMock.mockResolvedValue(
        response({ json: { data: { UploadProfileImage: { id: 'u1' } } } })
      );

      await uploadProfileImage(pngFile());

      const operations = sentOperations();
      expect(operations.operationName).toBe('UploadProfileImage');
      expect(operations.variables).toEqual({ image: null });
      expect(operations.query).toContain('mutation UploadProfileImage($image: Upload!)');
    });

    it('maps part "0" onto variables.image and appends the file under it', async () => {
      fetchMock.mockResolvedValue(
        response({ json: { data: { UploadProfileImage: { id: 'u1' } } } })
      );

      await uploadProfileImage(pngFile('me.png'));

      const form = sentForm();
      expect(JSON.parse(form.get('map') as string)).toEqual({ '0': ['variables.image'] });
      const part = form.get('0') as File;
      expect(part).toBeInstanceOf(File);
      expect(part.name).toBe('me.png');
      // spec order: operations, then map, then the file parts
      expect([...form.keys()]).toEqual(['operations', 'map', '0']);
    });

    it('returns the user payload on success', async () => {
      const user = { id: 'u1', username: 'james', profileImageUrl: 'https://cdn/x.png' };
      fetchMock.mockResolvedValue(response({ json: { data: { UploadProfileImage: user } } }));

      await expect(uploadProfileImage(pngFile())).resolves.toEqual(user);
    });

    it('throws with the status text on a non-2xx response', async () => {
      const res = response({
        ok: false,
        status: 413,
        statusText: 'Payload Too Large',
        text: 'file too big'
      });
      fetchMock.mockResolvedValue(res);

      await expect(uploadProfileImage(pngFile())).rejects.toThrow(
        'Upload failed: 413 Payload Too Large'
      );
      // the body is read so the reason reaches the logs
      expect(res.text).toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('surfaces the first GraphQL error from a 200 response', async () => {
      fetchMock.mockResolvedValue(
        response({ json: { errors: [{ message: 'unsupported media type' }, { message: 'second' }] } })
      );

      await expect(uploadProfileImage(pngFile())).rejects.toThrow('unsupported media type');
    });

    it('falls back to a generic message when the GraphQL error has none', async () => {
      fetchMock.mockResolvedValue(response({ json: { errors: [{}] } }));

      await expect(uploadProfileImage(pngFile())).rejects.toThrow(
        'Upload failed with GraphQL errors'
      );
    });

    it('rejects a 200 that carries nothing', async () => {
      fetchMock.mockResolvedValue(response({ json: {} }));

      await expect(uploadProfileImage(pngFile())).rejects.toThrow('No data returned from upload');
    });

    it('rejects a 200 whose data object lacks the mutation field', async () => {
      fetchMock.mockResolvedValue(response({ json: { data: { SomethingElse: {} } } }));

      await expect(uploadProfileImage(pngFile())).rejects.toThrow('No data returned from upload');
    });

    it('treats an empty errors array as no errors', async () => {
      const user = { id: 'u1' };
      fetchMock.mockResolvedValue(
        response({ json: { errors: [], data: { UploadProfileImage: user } } })
      );

      await expect(uploadProfileImage(pngFile())).resolves.toEqual(user);
    });

    it('propagates a rejected fetch', async () => {
      fetchMock.mockRejectedValue(new Error('network down'));

      await expect(uploadProfileImage(pngFile())).rejects.toThrow('network down');
      expect(mockDebug.error).toHaveBeenCalledWith(
        'Profile image upload failed:',
        expect.objectContaining({ message: 'network down' })
      );
    });
  });

  describe('uploadBannerImage', () => {
    it('uses the banner mutation with the same multipart shape', async () => {
      fetchMock.mockResolvedValue(
        response({ json: { data: { UploadBannerImage: { id: 'u1' } } } })
      );

      await uploadBannerImage(pngFile('banner.jpg'));

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(GRAPHQL_HOST);
      expect(init.method).toBe('POST');
      expect(init.credentials).toBe('include');

      const operations = sentOperations();
      expect(operations.operationName).toBe('UploadBannerImage');
      expect(operations.variables).toEqual({ image: null });
      expect(operations.query).toContain('bannerImageUrl');

      const form = sentForm();
      expect(JSON.parse(form.get('map') as string)).toEqual({ '0': ['variables.image'] });
      expect((form.get('0') as File).name).toBe('banner.jpg');
    });

    it('returns the profile payload on success', async () => {
      const profile = { id: 'u1', bannerImageUrl: 'https://cdn/b.png' };
      fetchMock.mockResolvedValue(response({ json: { data: { UploadBannerImage: profile } } }));

      await expect(uploadBannerImage(pngFile())).resolves.toEqual(profile);
    });

    it('throws on a non-2xx response', async () => {
      fetchMock.mockResolvedValue(
        response({ ok: false, status: 500, statusText: 'Internal Server Error', text: 'boom' })
      );

      await expect(uploadBannerImage(pngFile())).rejects.toThrow(
        'Upload failed: 500 Internal Server Error'
      );
    });

    it('surfaces a GraphQL error', async () => {
      fetchMock.mockResolvedValue(response({ json: { errors: [{ message: 'not allowed' }] } }));

      await expect(uploadBannerImage(pngFile())).rejects.toThrow('not allowed');
    });

    it('rejects a 200 that carries nothing', async () => {
      fetchMock.mockResolvedValue(response({ json: { data: null } }));

      await expect(uploadBannerImage(pngFile())).rejects.toThrow('No data returned from upload');
    });

    it('propagates a rejected fetch', async () => {
      fetchMock.mockRejectedValue(new Error('offline'));

      await expect(uploadBannerImage(pngFile())).rejects.toThrow('offline');
    });
  });
});
