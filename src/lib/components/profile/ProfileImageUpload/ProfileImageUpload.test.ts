import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  PRESETS,
  ProfileImageUploadBloc,
  initialCrop,
  maxCropWidth,
  type ProfileImageUploadDeps,
  type ProfileImageUploadInputs,
  type ProfileImageVariant
} from './ProfileImageUpload.bloc.svelte';

/**
 * The bloc around the crop maths: what it accepts, what it refuses, how the
 * frame moves, and what a save does to the cache.
 *
 * The pure arithmetic has its own file (`ProfileImageUpload.crop.test.ts`);
 * this one is about the state and the ports.
 */

const VIEWPORT = { width: 1280, height: 800 };

function makeBloc(
  inputs: Partial<ProfileImageUploadInputs> = {},
  deps: ProfileImageUploadDeps = {}
) {
  const cache = { setQueryData: vi.fn(), invalidateQueries: vi.fn() };
  const upload = vi.fn(async (_file: File) => ({ profileImageUrl: 'new.jpg' }));
  const bloc = new ProfileImageUploadBloc(
    { variant: 'avatar', cache, ...inputs },
    {
      uploads: { avatar: upload, banner: upload },
      viewport: () => VIEWPORT,
      delay: (callback) => callback(),
      ...deps
    }
  );
  return { bloc, cache, upload };
}

/** A canvas that renders nothing but answers like one. */
function fakeCanvas(blob: Blob | null = new Blob(['x'], { type: 'image/jpeg' })) {
  const context = {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    clip: vi.fn(),
    drawImage: vi.fn()
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => context),
    toBlob: (cb: (b: Blob | null) => void) => cb(blob)
  };
  return { canvas: canvas as unknown as HTMLCanvasElement, context };
}

/** jsdom never loads an <img>, so the decode step is stubbed to succeed. */
function stubImageLoads(succeed = true) {
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    width = 1200;
    height = 1200;
    set src(_value: string) {
      queueMicrotask(() => (succeed ? this.onload?.() : this.onerror?.()));
    }
  }
  vi.stubGlobal('Image', FakeImage);
}

afterEach(() => vi.unstubAllGlobals());

describe('PRESETS', () => {
  it('gives the avatar a square, circular crop and the banner a 4:1 strip', () => {
    expect(PRESETS.avatar.aspect).toBe(1);
    expect(PRESETS.avatar.circular).toBe(true);
    expect(PRESETS.banner.aspect).toBe(4);
    expect(PRESETS.banner.circular).toBe(false);
  });

  it('exports each at twice its accepted minimum', () => {
    for (const preset of Object.values(PRESETS)) {
      expect(preset.output.w).toBe(preset.min.w * 2);
      expect(preset.output.h).toBe(preset.min.h * 2);
    }
  });

  it('names the file each variant uploads', () => {
    expect(PRESETS.avatar.fileName).toBe('profile.jpg');
    expect(PRESETS.banner.fileName).toBe('banner.jpg');
  });
});

describe('ProfileImageUploadBloc', () => {
  describe('before a picture is chosen', () => {
    it('has nothing to frame', () => {
      const { bloc } = makeBloc();

      expect(bloc.previewUrl).toBeNull();
      expect(bloc.crop).toEqual({ x: 0, y: 0, width: 0 });
      expect(bloc.uploadError).toBeNull();
      expect(bloc.isUploading).toBe(false);
      expect(bloc.saveStatus).toBe('idle');
    });

    it('reports the variant it is cropping for', () => {
      for (const variant of ['avatar', 'banner'] as ProfileImageVariant[]) {
        const { bloc } = makeBloc({ variant });

        expect(bloc.variant).toBe(variant);
        expect(bloc.preset).toBe(PRESETS[variant]);
      }
    });

    it('tracks a file hovering over the dropzone', () => {
      const { bloc } = makeBloc();

      bloc.setDragActive(true);
      expect(bloc.dragActive).toBe(true);

      bloc.setDragActive(false);
      expect(bloc.dragActive).toBe(false);
    });
  });

  describe('taking a picture', () => {
    it('fits it to the modal and opens the crop centred', () => {
      const { bloc } = makeBloc();

      bloc.useImage('blob:x', { width: 1200, height: 1200 });

      expect(bloc.previewUrl).toBe('blob:x');
      expect(bloc.imageSize.width).toBeLessThanOrEqual(600);
      expect(bloc.crop).toEqual(initialCrop(bloc.imageSize, 1));
    });

    it('refuses one too small to crop sharply, and says the numbers', () => {
      const { bloc } = makeBloc();

      bloc.useImage('blob:x', { width: 200, height: 200 });

      // Rather than silently upscaling it into a blurry avatar.
      expect(bloc.uploadError).toBe('That image is 200×200. Use one at least 400×400.');
      expect(bloc.previewUrl).toBeNull();
    });

    it('applies each variant’s own minimum', () => {
      const { bloc: banner } = makeBloc({ variant: 'banner' });

      // 500x200 is too narrow for a banner but taller than the avatar minimum.
      banner.useImage('blob:x', { width: 500, height: 200 });
      expect(banner.uploadError).toContain('at least 800×200');

      banner.useImage('blob:x', { width: 1000, height: 250 });
      expect(banner.uploadError).toBeNull();
    });

    it('clears an earlier complaint when an acceptable picture arrives', () => {
      const { bloc } = makeBloc();
      bloc.useImage('blob:x', { width: 200, height: 200 });

      bloc.useImage('blob:y', { width: 1200, height: 1200 });

      expect(bloc.uploadError).toBeNull();
    });

    it('fits into a narrow viewport rather than overflowing it', () => {
      const { bloc } = makeBloc({}, { viewport: () => ({ width: 400, height: 800 }) });

      bloc.useImage('blob:x', { width: 1200, height: 1200 });

      expect(bloc.imageSize.width).toBeLessThanOrEqual(320);
    });

    it('ignores a dropped file that is not an image', () => {
      const { bloc } = makeBloc();
      bloc.setDragActive(true);

      bloc.acceptFile(new File(['x'], 'notes.txt', { type: 'text/plain' }));

      expect(bloc.previewUrl).toBeNull();
      // The dropzone stops highlighting either way.
      expect(bloc.dragActive).toBe(false);
    });

    it('ignores no file at all', () => {
      const { bloc } = makeBloc();

      expect(() => bloc.acceptFile(null)).not.toThrow();
      expect(() => bloc.acceptFile(undefined)).not.toThrow();
    });
  });

  describe('moving the frame', () => {
    /**
     * Zoomed in and nudged off the edge first: the opening crop is the largest
     * box that fits, so it is pinned on one axis and has nowhere to go.
     */
    function framed() {
      const made = makeBloc();
      made.bloc.useImage('blob:x', { width: 1200, height: 800 });
      made.bloc.setZoom(50);
      made.bloc.nudge(20, 20);
      return made;
    }

    it('drags relative to where the pointer went down', () => {
      const { bloc } = framed();
      const start = bloc.crop;

      bloc.startDrag({ x: start.x + 10, y: start.y + 10 });
      bloc.dragTo({ x: start.x + 30, y: start.y + 25 });

      expect(bloc.crop.x).toBeCloseTo(start.x + 20, 5);
      expect(bloc.crop.y).toBeCloseTo(start.y + 15, 5);
    });

    it('ignores movement that did not start with a drag', () => {
      const { bloc } = framed();
      const start = bloc.crop;

      bloc.dragTo({ x: 999, y: 999 });

      expect(bloc.crop).toEqual(start);
    });

    it('stops moving once the drag ends', () => {
      const { bloc } = framed();
      bloc.startDrag({ x: 0, y: 0 });
      bloc.endDrag();
      const stopped = bloc.crop;

      bloc.dragTo({ x: 200, y: 200 });

      expect(bloc.crop).toEqual(stopped);
    });

    it('keeps the box inside the picture however far it is dragged', () => {
      const { bloc } = framed();

      bloc.startDrag({ x: bloc.crop.x, y: bloc.crop.y });
      bloc.dragTo({ x: 99999, y: 99999 });

      expect(bloc.crop.x).toBeCloseTo(bloc.imageSize.width - bloc.crop.width, 5);
      expect(bloc.crop.y).toBeCloseTo(bloc.imageSize.height - bloc.cropHeight, 5);

      bloc.dragTo({ x: -99999, y: -99999 });
      expect(bloc.crop.x).toBe(0);
      expect(bloc.crop.y).toBe(0);
    });

    it('nudges with the arrow keys, so positioning is not mouse-only', () => {
      const { bloc } = framed();
      const start = bloc.crop;

      bloc.nudge(5, -5);

      expect(bloc.crop.x).toBeCloseTo(start.x + 5, 5);
      expect(bloc.crop.y).toBeCloseTo(start.y - 5, 5);
    });

    it('clamps a nudge at the edge', () => {
      const { bloc } = framed();
      bloc.nudge(-9999, -9999);

      expect(bloc.crop.x).toBe(0);
      expect(bloc.crop.y).toBe(0);
    });
  });

  describe('zoom', () => {
    function framed() {
      const made = makeBloc();
      made.bloc.useImage('blob:x', { width: 1200, height: 800 });
      return made;
    }

    it('opens fully zoomed out', () => {
      const { bloc } = framed();

      expect(bloc.zoomPercent).toBeCloseTo(0, 5);
      expect(bloc.zoomFactor).toBeCloseTo(1, 5);
    });

    it('takes the slider to the right as more zoom, i.e. a smaller box', () => {
      const { bloc } = framed();
      const widest = bloc.crop.width;

      bloc.setZoom(100);

      expect(bloc.crop.width).toBeLessThan(widest);
      expect(bloc.zoomPercent).toBeCloseTo(100, 5);
      expect(bloc.zoomFactor).toBeCloseTo(2, 5);
    });

    it('round-trips a slider position', () => {
      const { bloc } = framed();

      bloc.setZoom(40);

      expect(bloc.zoomPercent).toBeCloseTo(40, 5);
    });

    it('keeps the zoomed box inside the picture', () => {
      const { bloc } = framed();
      bloc.setZoom(100);
      bloc.nudge(9999, 9999);

      bloc.setZoom(0);

      expect(bloc.crop.x).toBeGreaterThanOrEqual(0);
      expect(bloc.crop.x + bloc.crop.width).toBeLessThanOrEqual(bloc.imageSize.width + 1e-9);
    });

    it('reports the resolution actually kept from the source', () => {
      const { bloc } = makeBloc();
      bloc.useImage('blob:x', { width: 1200, height: 1200 });

      // Fully zoomed out on a square source: the whole picture.
      expect(bloc.keptSize).toEqual({ width: 1200, height: 1200 });

      bloc.setZoom(100);
      expect(bloc.keptSize.width).toBe(600);
      expect(bloc.keptSize.height).toBe(600);
    });

    it('keeps the banner’s readout in its own aspect', () => {
      const { bloc } = makeBloc({ variant: 'banner' });
      bloc.useImage('blob:x', { width: 1600, height: 400 });

      expect(bloc.keptSize.width / bloc.keptSize.height).toBeCloseTo(4, 5);
      expect(bloc.cropHeight).toBeCloseTo(bloc.crop.width / 4, 5);
    });

    it('reports a zoom factor of one before there is a box', () => {
      const { bloc } = makeBloc();

      expect(bloc.zoomFactor).toBe(1);
      expect(maxCropWidth({ width: 0, height: 0 }, 1)).toBe(0);
    });
  });

  describe('saving', () => {
    function framed(deps: ProfileImageUploadDeps = {}, inputs: Partial<ProfileImageUploadInputs> = {}) {
      const made = makeBloc(inputs, deps);
      made.bloc.useImage('blob:x', { width: 1200, height: 1200 });
      return made;
    }

    it('does nothing without a picture or without a canvas', async () => {
      const { bloc, upload } = makeBloc();
      const { canvas } = fakeCanvas();

      await bloc.save(canvas);
      expect(upload).not.toHaveBeenCalled();

      bloc.useImage('blob:x', { width: 1200, height: 1200 });
      await bloc.save(undefined);
      expect(upload).not.toHaveBeenCalled();
    });

    it('uploads the rendered crop under the variant’s file name', async () => {
      stubImageLoads();
      const { bloc, upload } = framed();
      const { canvas } = fakeCanvas();

      await bloc.save(canvas);

      expect(upload).toHaveBeenCalledTimes(1);
      const file = upload.mock.calls[0][0];
      expect(file.name).toBe('profile.jpg');
      expect(file.type).toBe('image/jpeg');
    });

    it('exports at the variant’s output size, clipped to a circle for the avatar', async () => {
      stubImageLoads();
      const { bloc } = framed();
      const { canvas, context } = fakeCanvas();

      await bloc.save(canvas);

      expect(canvas.width).toBe(800);
      expect(canvas.height).toBe(800);
      // The export is JPEG with no alpha, so anything outside would fill black.
      expect(context.clip).toHaveBeenCalledTimes(1);
    });

    it('does not clip the banner', async () => {
      stubImageLoads();
      const { bloc } = makeBloc({ variant: 'banner' });
      bloc.useImage('blob:x', { width: 1600, height: 400 });
      const { canvas, context } = fakeCanvas();

      await bloc.save(canvas);

      expect(canvas.width).toBe(1600);
      expect(canvas.height).toBe(400);
      expect(context.clip).not.toHaveBeenCalled();
    });

    it('merges the new URL into the cached user rather than replacing it', async () => {
      stubImageLoads();
      const { bloc, cache } = framed();
      const { canvas } = fakeCanvas();

      await bloc.save(canvas);

      const updater = cache.setQueryData.mock.calls[0][1] as (p: unknown) => unknown;
      // Uploading one image must not drop the other's URL.
      expect(updater({ username: 'ada', bannerUrl: 'old-banner.jpg' })).toEqual({
        username: 'ada',
        bannerUrl: 'old-banner.jpg',
        profileImageUrl: 'new.jpg'
      });
      expect(cache.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['user'] });
    });

    it('survives a page that handed over no cache', async () => {
      stubImageLoads();
      const { bloc } = framed({}, { cache: undefined });
      const { canvas } = fakeCanvas();

      await expect(bloc.save(canvas)).resolves.toBeUndefined();
    });

    it('confirms for a beat, then closes', async () => {
      stubImageLoads();
      const onClose = vi.fn();
      const delays: number[] = [];
      const { bloc } = framed(
        { delay: (callback, ms) => (delays.push(ms), callback()) },
        { onClose }
      );
      const { canvas } = fakeCanvas();

      await bloc.save(canvas);

      // Not a spinner and then silence at the highest-stakes moment.
      expect(delays).toEqual([900]);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('reports a failed upload to the user, not only to the console', async () => {
      stubImageLoads();
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { bloc } = framed({
        uploads: {
          avatar: vi.fn(async () => Promise.reject(new Error('413 too large'))),
          banner: vi.fn()
        }
      });
      const { canvas } = fakeCanvas();

      await bloc.save(canvas);

      // A console line is compiled out of production.
      expect(bloc.uploadError).toBe('Upload failed: 413 too large');
      expect(bloc.saveStatus).toBe('error');
      expect(bloc.isUploading).toBe(false);
      errors.mockRestore();
    });

    it('has its own words for a failure that carried none', async () => {
      stubImageLoads();
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { bloc } = framed({
        uploads: { avatar: vi.fn(async () => Promise.reject({})), banner: vi.fn() }
      });
      const { canvas } = fakeCanvas();

      await bloc.save(canvas);

      expect(bloc.uploadError).toBe('Upload failed. Please try again.');
      errors.mockRestore();
    });

    it('says so when the picture could not be rendered at all', async () => {
      stubImageLoads(false);
      const { bloc, upload } = framed();
      const { canvas } = fakeCanvas();

      await bloc.save(canvas);

      expect(bloc.uploadError).toBe('Could not process that image. Try a different file.');
      expect(upload).not.toHaveBeenCalled();
    });

    it('says so when there is no 2d context to draw into', async () => {
      stubImageLoads();
      const { bloc } = framed();
      const canvas = { getContext: () => null } as unknown as HTMLCanvasElement;

      await bloc.save(canvas);

      expect(bloc.uploadError).toBe('Could not process that image. Try a different file.');
    });
  });

  describe('leaving', () => {
    it('throws the picture away and tells the view', () => {
      const onClose = vi.fn();
      const { bloc } = makeBloc({ onClose });
      bloc.useImage('blob:x', { width: 1200, height: 1200 });

      bloc.close();

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(bloc.previewUrl).toBeNull();
      expect(bloc.crop).toEqual({ x: 0, y: 0, width: 0 });
      expect(bloc.uploadError).toBeNull();
    });

    it('closes cleanly when the view wired up no handler', () => {
      const { bloc } = makeBloc({ onClose: undefined });

      expect(() => bloc.close()).not.toThrow();
    });

    it('reopens the file picker after throwing the picture away', () => {
      const pick = vi.fn();
      const { bloc } = makeBloc();
      bloc.useImage('blob:x', { width: 1200, height: 1200 });

      bloc.chooseNewImage(pick);

      expect(bloc.previewUrl).toBeNull();
      expect(pick).toHaveBeenCalledTimes(1);
    });
  });
});
