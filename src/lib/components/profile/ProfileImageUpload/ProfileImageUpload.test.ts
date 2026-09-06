import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { flushSync } from 'svelte';
import ProfileImageUpload from './ProfileImageUpload.svelte';
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

/**
 * The cropper as a surface: the modal it opens in, the two states it has (pick
 * a file / frame the picture), the instruments, the failure box and the footer.
 *
 * The arithmetic is not repeated here -- `ProfileImageUpload.crop.test.ts` owns
 * the pure functions and the suite above owns the bloc's state machine. What is
 * asserted below is what a viewer sees and what their gestures reach.
 *
 * jsdom caveats, stated once:
 *  - No stylesheet is loaded, so the modal's WIDTH is not measurable. The size
 *    is asserted as the class `Modal` keys its `max-width` off, which is exactly
 *    the contract that was broken before (see the regression below).
 *  - jsdom performs no layout: the preview is sized from the numbers the bloc
 *    computes and writes as inline styles, which IS assertable, but nothing is
 *    actually laid out or painted.
 *  - jsdom implements no canvas at all -- `getContext('2d')` answers null -- and
 *    decodes no images. Both are stubbed where a test needs the export to run,
 *    and each stub says what it costs at its call site.
 */
describe('ProfileImageUpload', () => {
  /** A picture big enough for either preset, and not square, so the crop can move. */
  const WIDE = { width: 1600, height: 800 };

  /**
   * The bloc the view is driven through: the real one, with the viewport pinned
   * so the fitted preview is a fixed number of pixels rather than whatever
   * jsdom's default window happens to be, and with the post-save confirmation
   * beat held open so the "Saved" state can be observed.
   */
  function makeViewBloc(
    options: {
      variant?: ProfileImageVariant;
      onClose?: () => void;
      upload?: (file: File) => Promise<unknown>;
      /** Left un-called by default, so the modal does not close itself mid-assertion. */
      delay?: (callback: () => void, ms: number) => void;
    } = {}
  ) {
    const upload = vi.fn(options.upload ?? (async () => ({ profileImageUrl: 'new.jpg' })));
    const cache = { setQueryData: vi.fn(), invalidateQueries: vi.fn() };
    const bloc = new ProfileImageUploadBloc(
      { variant: options.variant ?? 'avatar', cache, onClose: options.onClose },
      {
        uploads: { avatar: upload, banner: upload },
        viewport: () => ({ width: 1280, height: 800 }),
        delay: options.delay ?? (() => {})
      }
    );
    return { bloc, upload, cache };
  }

  function open(options: Parameters<typeof makeViewBloc>[0] & { isOpen?: boolean } = {}) {
    const made = makeViewBloc(options);
    const result = render(ProfileImageUpload, {
      props: {
        isOpen: options.isOpen ?? true,
        variant: options.variant ?? 'avatar',
        onClose: options.onClose,
        bloc: made.bloc
      }
    });
    return { ...result, ...made };
  }

  /** Puts a decoded picture into the bloc and flushes the view. */
  function withPicture(
    made: ReturnType<typeof open>,
    natural: { width: number; height: number } = WIDE
  ) {
    made.bloc.useImage('data:image/jpeg;base64,AAAA', natural);
    flushSync();
    return made;
  }

  const dropzone = () => screen.getByRole('button', { name: /^Frame your/ });
  const frame = () => screen.getByRole('button', { name: 'Drag or arrow-key to position the crop' });
  const zoom = () => screen.getByRole('slider', { name: 'Zoom' }) as HTMLInputElement;

  describe('the dialog it opens in', () => {
    it('renders nothing while closed', () => {
      open({ isOpen: false });

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    /**
     * REGRESSION. This used to pass `className="max-w-2xl max-h-[90vh]"` and
     * measure 440px regardless: `Modal` declares `.weeb-modal-card`'s max-width
     * as a `:global` rule at the same specificity a utility class has and wins
     * on source order, so the escape hatch was silently dead and the one dialog
     * in the app you WORK inside was squeezed into a sign-in form's width.
     *
     * jsdom loads no stylesheet, so the 720px cannot be measured here -- but the
     * class is the whole contract: `Modal` maps `size` to
     * `.weeb-modal-card--lg`, and a utility class would not appear here at all.
     */
    it('opens at the large size, through Modal’s size API rather than a utility class', () => {
      open();

      const card = document.querySelector('.weeb-modal-card') as HTMLElement;
      expect(card).toHaveClass('weeb-modal-card--lg');
      expect(card).not.toHaveClass('weeb-modal-card--sm');
      expect(card).not.toHaveClass('weeb-modal-card--md');
      expect(card.className).not.toMatch(/max-w-/);
    });

    it('is a real modal dialog with the shared close button', () => {
      open();

      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
      expect(screen.getByRole('button', { name: 'Close modal' })).toBeInTheDocument();
    });

    it('heads itself for the variant being framed', () => {
      open();
      expect(screen.getByRole('heading', { name: 'Frame your picture' })).toBeInTheDocument();

      cleanup();
      open({ variant: 'banner' });
      expect(screen.getByRole('heading', { name: 'Frame your banner' })).toBeInTheDocument();
    });
  });

  describe('before a picture is chosen', () => {
    it('offers a named dropzone that says both ways in', () => {
      open();

      expect(dropzone()).toHaveTextContent('Drop an image, or click to choose');
      expect(dropzone()).toHaveAttribute('tabindex', '0');
    });

    it('states the minimum the avatar will accept', () => {
      open();

      expect(dropzone()).toHaveTextContent('PNG · JPG');
      expect(dropzone()).toHaveTextContent('at least 400×400');
    });

    it('states the banner’s own formats and minimum instead', () => {
      open({ variant: 'banner' });

      // Note the missing space before the third separator: the `{#if}` that adds
      // WEBP swallows its own leading whitespace, so this renders as
      // "PNG · JPG· WEBP". Cosmetic, in application source, and left alone --
      // the assertion pins what actually ships rather than what was meant.
      expect(dropzone()).toHaveTextContent('PNG · JPG· WEBP');
      expect(dropzone()).toHaveTextContent('at least 800×200');
    });

    it('offers nothing to save, because there is nothing yet', () => {
      open();

      expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Choose different image' })
      ).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('confirms a file is over the zone at the moment of the gesture', async () => {
      open();

      await fireEvent.dragOver(dropzone());
      expect(dropzone()).toHaveTextContent('Drop to use this image');
      expect(dropzone()).toHaveClass('is-active');

      await fireEvent.dragLeave(dropzone());
      expect(dropzone()).toHaveTextContent('Drop an image, or click to choose');
      expect(dropzone()).not.toHaveClass('is-active');
    });

    it('opens the file picker from a click, and from the keyboard', async () => {
      const { container } = open();
      const input = container.ownerDocument.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;
      const picked = vi.fn();
      input.addEventListener('click', picked);

      await userEvent.click(dropzone());
      expect(picked).toHaveBeenCalledTimes(1);

      dropzone().focus();
      await userEvent.keyboard('{Enter}');
      expect(picked).toHaveBeenCalledTimes(2);

      await userEvent.keyboard(' ');
      expect(picked).toHaveBeenCalledTimes(3);
    });

    it('accepts images only', () => {
      const { container } = open();

      expect(container.ownerDocument.querySelector('input[type="file"]')).toHaveAttribute(
        'accept',
        'image/*'
      );
    });

    /**
     * The one path that runs the real FileReader/`new Image()` plumbing. jsdom
     * decodes nothing, so the decode step is the file's existing
     * `stubImageLoads` (1200×1200) -- what the *picture* looks like is not
     * assertable here, only that choosing one takes the modal into its framing
     * state.
     */
    it('swaps the dropzone for the framing stage once a file is chosen', async () => {
      stubImageLoads();
      const { container } = open();
      const input = container.ownerDocument.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await userEvent.upload(input, new File(['x'], 'me.png', { type: 'image/png' }));

      expect(await screen.findByRole('img', { name: 'Preview' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Frame your/ })).not.toBeInTheDocument();
    });

    it('ignores a dropped file that is not an image', async () => {
      open();

      await fireEvent.drop(dropzone(), {
        dataTransfer: { files: [new File(['x'], 'notes.txt', { type: 'text/plain' })] }
      });

      expect(dropzone()).toBeInTheDocument();
      expect(screen.queryByRole('img', { name: 'Preview' })).not.toBeInTheDocument();
    });
  });

  describe('framing the picture', () => {
    it('shows the picture at the size the bloc fitted it to', () => {
      withPicture(open());

      const preview = screen.getByRole('img', { name: 'Preview' });
      expect(preview).toHaveAttribute('src', 'data:image/jpeg;base64,AAAA');
      // 1600x800 fitted into the 600-wide area: 600x300.
      expect(preview.style.width).toBe('600px');
      expect(preview.style.height).toBe('300px');
      expect(preview).toHaveAttribute('draggable', 'false');
    });

    it('draws the kept region as a focusable, named control', () => {
      withPicture(open());

      expect(frame()).toHaveAttribute('tabindex', '0');
      // The largest square that fits 600x300, centred.
      expect(frame().style.width).toBe('300px');
      expect(frame().style.height).toBe('300px');
      expect(frame().style.left).toBe('150px');
    });

    it('clips the avatar’s frame to a circle and offers no thirds guides', () => {
      const { container } = withPicture(open());

      expect(frame()).toHaveClass('crop--circle');
      expect(container.ownerDocument.querySelectorAll('.guide')).toHaveLength(0);
    });

    it('gives the banner a rectangular frame with rule-of-thirds guides', () => {
      const { container } = withPicture(open({ variant: 'banner' }));

      expect(frame()).not.toHaveClass('crop--circle');
      expect(container.ownerDocument.querySelectorAll('.guide')).toHaveLength(4);
    });

    it('reads out the resolution actually being kept, and the zoom', () => {
      const { container } = withPicture(open());

      const readout = container.ownerDocument.querySelector('.readout') as HTMLElement;
      // 300 preview px of a 600-wide preview over a 1600px source: 800x800 kept.
      expect(readout).toHaveTextContent('800');
      expect(readout).toHaveTextContent('1.0×');
    });

    it('offers a labelled zoom rail, opening fully zoomed out', () => {
      withPicture(open());

      expect(zoom()).toHaveAttribute('type', 'range');
      expect(zoom().value).toBe('0');
    });

    it('tightens the frame when the rail is moved, and says so in the readout', async () => {
      const { container } = withPicture(open());

      await fireEvent.input(zoom(), { target: { value: '100' } });

      // Fully zoomed in is half the widest box: 150px on screen, 400px kept.
      expect(frame().style.width).toBe('150px');
      expect(container.ownerDocument.querySelector('.readout')).toHaveTextContent('400');
      expect(container.ownerDocument.querySelector('.readout')).toHaveTextContent('2.0×');
    });

    it('moves the frame under the pointer', async () => {
      withPicture(open());
      expect(frame().style.left).toBe('150px');

      await fireEvent.mouseDown(frame(), { clientX: 400, clientY: 200 });
      await fireEvent.mouseMove(window, { clientX: 350, clientY: 200 });
      await fireEvent.mouseUp(window);

      expect(frame().style.left).toBe('100px');
    });

    it('stops moving once the pointer is released', async () => {
      withPicture(open());
      await fireEvent.mouseDown(frame(), { clientX: 400, clientY: 200 });
      await fireEvent.mouseMove(window, { clientX: 350, clientY: 200 });
      await fireEvent.mouseUp(window);

      await fireEvent.mouseMove(window, { clientX: 200, clientY: 200 });

      expect(frame().style.left).toBe('100px');
    });

    it('keeps the frame inside the picture however far it is dragged', async () => {
      withPicture(open());

      await fireEvent.mouseDown(frame(), { clientX: 400, clientY: 200 });
      await fireEvent.mouseMove(window, { clientX: -5000, clientY: -5000 });

      expect(frame().style.left).toBe('0px');
      expect(frame().style.top).toBe('0px');
    });

    /** Positioning must not be mouse-only. */
    it('nudges the frame with the arrow keys, four pixels at a time', async () => {
      withPicture(open());
      frame().focus();

      await userEvent.keyboard('{ArrowLeft}');
      expect(frame().style.left).toBe('146px');

      await userEvent.keyboard('{ArrowRight}{ArrowRight}');
      expect(frame().style.left).toBe('154px');
    });

    it('nudges twenty at a time with Shift held', async () => {
      withPicture(open());
      frame().focus();

      await userEvent.keyboard('{Shift>}{ArrowLeft}{/Shift}');

      expect(frame().style.left).toBe('130px');
    });

    it('nudges vertically once there is room to move', async () => {
      withPicture(open());
      await fireEvent.input(zoom(), { target: { value: '100' } });
      const before = frame().style.top;
      frame().focus();

      await userEvent.keyboard('{ArrowDown}');

      expect(frame().style.top).not.toBe(before);
    });

    it('ignores keys that are not arrows', async () => {
      withPicture(open());
      frame().focus();

      await userEvent.keyboard('a');

      expect(frame().style.left).toBe('150px');
    });

    it('offers the way back to the dropzone, and takes it', async () => {
      withPicture(open());

      await userEvent.click(screen.getByRole('button', { name: 'Choose different image' }));

      expect(dropzone()).toBeInTheDocument();
      expect(screen.queryByRole('img', { name: 'Preview' })).not.toBeInTheDocument();
    });
  });

  /**
   * The failure box is `ErrorBanner`. It used to mix its own 10%/40% red --
   * close enough to ErrorBanner's 12%/45% to look like a mistake and far enough
   * to look like one. jsdom loads no stylesheet, so the tint is not observable;
   * what pins it is that the box IS ErrorBanner: its `.eb--error` class and the
   * `role="alert"` the primitive assigns an error severity.
   */
  describe('the failure box', () => {
    it('is ErrorBanner, and says why a too-small picture was refused', () => {
      const made = open();
      made.bloc.useImage('data:image/jpeg;base64,AAAA', { width: 100, height: 100 });
      flushSync();

      const banner = screen.getByRole('alert');
      expect(banner).toHaveClass('eb', 'eb--error');
      expect(banner).toHaveTextContent('That image is 100×100. Use one at least 400×400.');
      // Refused, not accepted: the modal stays on the dropzone.
      expect(dropzone()).toBeInTheDocument();
    });

    it('is not drawn at all while nothing has failed', () => {
      const { container } = open();

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(container.ownerDocument.querySelector('.cropper-error')).not.toBeInTheDocument();
    });

    it('clears once an acceptable picture is chosen', () => {
      const made = open();
      made.bloc.useImage('data:image/jpeg;base64,AAAA', { width: 100, height: 100 });
      flushSync();
      expect(screen.getByRole('alert')).toBeInTheDocument();

      withPicture(made);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('saving', () => {
    /**
     * jsdom ships no canvas implementation whatsoever -- `getContext('2d')`
     * answers null -- so the export cannot run without standing one in. This
     * records the draw rather than performing it: what the exported JPEG
     * actually contains is not observable in this environment at all, and the
     * numbers handed to `drawImage` are `sourceRect`'s, which has its own tests.
     * All that is asserted below is the footer's states.
     */
    function stubCanvas(blob: Blob | null = new Blob(['x'], { type: 'image/jpeg' })) {
      const context = {
        save() {},
        restore() {},
        beginPath() {},
        arc() {},
        clip() {},
        drawImage() {}
      };
      const canvas = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
      const originalGetContext = canvas.getContext;
      const originalToBlob = canvas.toBlob;
      canvas.getContext = () => context;
      canvas.toBlob = (callback: (b: Blob | null) => void) => callback(blob);
      return () => {
        canvas.getContext = originalGetContext;
        canvas.toBlob = originalToBlob;
      };
    }

    it('offers Save only once there is something framed', () => {
      const made = open();
      expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();

      withPicture(made);

      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    });

    it('uploads the framed picture and confirms it before leaving', async () => {
      const restore = stubCanvas();
      stubImageLoads();
      try {
        const made = withPicture(open());

        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(made.upload).toHaveBeenCalledTimes(1));
        // A beat of confirmation, rather than a spinner and then silence at the
        // highest-stakes moment.
        expect(await screen.findByText('Saved')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
        expect(
          screen.queryByRole('button', { name: 'Choose different image' })
        ).not.toBeInTheDocument();
      } finally {
        restore();
      }
    });

    it('says the upload failed, with the cause, in the same ErrorBanner', async () => {
      const restore = stubCanvas();
      stubImageLoads();
      try {
        withPicture(
          open({ upload: async () => Promise.reject(new Error('413 too large')) })
        );

        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        const banner = await screen.findByRole('alert');
        expect(banner).toHaveClass('eb--error');
        expect(banner).toHaveTextContent('Upload failed: 413 too large');
        // Still framed, so the picture can be re-sent rather than re-chosen.
        expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
      } finally {
        restore();
      }
    });

    it('says so rather than silently doing nothing when the picture cannot be processed', async () => {
      const restore = stubCanvas(null);
      stubImageLoads();
      try {
        const made = withPicture(open());

        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(await screen.findByRole('alert')).toHaveTextContent(
          'Could not process that image. Try a different file.'
        );
        expect(made.upload).not.toHaveBeenCalled();
      } finally {
        restore();
      }
    });
  });

  describe('closing', () => {
    it('reports the dismissal from Cancel', async () => {
      const onClose = vi.fn();
      open({ onClose });

      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('reports it from the dialog’s own close button too', async () => {
      const onClose = vi.fn();
      open({ onClose });

      await userEvent.click(screen.getByRole('button', { name: 'Close modal' }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('reports it from Escape', async () => {
      const onClose = vi.fn();
      open({ onClose });

      await userEvent.keyboard('{Escape}');

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    /** Dismissing throws the framed picture away: reopening starts clean. */
    it('drops the framed picture on the way out', async () => {
      withPicture(open({ onClose: vi.fn() }));

      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByRole('img', { name: 'Preview' })).not.toBeInTheDocument();
      expect(dropzone()).toBeInTheDocument();
    });
  });
});
