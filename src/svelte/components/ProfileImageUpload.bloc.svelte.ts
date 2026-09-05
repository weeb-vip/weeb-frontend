export type ProfileImageVariant = 'avatar' | 'banner';

export interface Size {
  width: number;
  height: number;
}

/** The kept region, in on-screen preview pixels. Height follows from the aspect. */
export interface Crop {
  x: number;
  y: number;
  width: number;
}

export interface VariantPreset {
  aspect: number;
  circular: boolean;
  output: { w: number; h: number };
  min: { w: number; h: number };
  title: string;
  fileName: string;
}

/**
 * One cropper for both the avatar and the banner.
 *
 * They are the same interaction -- pick a file, frame a crop, export it --
 * differing only in the box's shape and where the result goes. So `variant`
 * switches the aspect (a square vs a 4:1 strip), whether the export is clipped
 * to a circle, the output size, the minimum accepted source, and which upload
 * it calls, rather than a second component copying the drag maths.
 */
export const PRESETS: Record<ProfileImageVariant, VariantPreset> = {
  avatar: {
    aspect: 1,
    circular: true,
    output: { w: 800, h: 800 },
    min: { w: 400, h: 400 },
    title: 'Frame your picture',
    fileName: 'profile.jpg'
  },
  banner: {
    aspect: 4,
    circular: false,
    output: { w: 1600, h: 400 },
    min: { w: 800, h: 200 },
    title: 'Frame your banner',
    fileName: 'banner.jpg'
  }
};

// ── The crop maths, as pure functions ────────────────────────────
// Every one of these is a plain calculation over numbers, which is why they
// live outside the class: they are the part of this component most worth
// testing, and they need neither a DOM nor a bloc instance to run.

/** Fits the source into the modal, preserving its aspect. */
export function fitPreview(natural: Size, area: Size): Size {
  let width = natural.width;
  let height = natural.height;
  if (width > area.width || height > area.height) {
    const scale = Math.min(area.width / width, area.height / height);
    width *= scale;
    height *= scale;
  }
  return { width, height };
}

/** Opens zoomed out: the largest box of the right aspect that fits, centred. */
export function initialCrop(display: Size, aspect: number): Crop {
  const width = Math.min(display.width, display.height * aspect);
  return { width, x: (display.width - width) / 2, y: (display.height - width / aspect) / 2 };
}

/**
 * Width is the binding dimension: the largest box of this aspect that fits is
 * the one whose height is the image height (or whose width is the image width,
 * whichever is smaller).
 */
export function maxCropWidth(display: Size, aspect: number): number {
  return Math.min(display.width, display.height * aspect);
}

/** Half the widest box; below that the export would be upscaled. */
export function minCropWidth(display: Size, aspect: number): number {
  return maxCropWidth(display, aspect) * 0.5;
}

/** Keeps the box inside the picture, whatever moved it. */
export function clampCrop(crop: Crop, display: Size, aspect: number): Crop {
  const height = crop.width / aspect;
  return {
    width: crop.width,
    x: Math.max(0, Math.min(crop.x, display.width - crop.width)),
    y: Math.max(0, Math.min(crop.y, display.height - height))
  };
}

/**
 * Zoom, not box size: a smaller box means a tighter frame, so 100% is the
 * smallest box (most zoomed in). Right on the slider is more zoom, which is
 * what every zoom control does.
 */
export function zoomPercent(width: number, display: Size, aspect: number): number {
  const max = maxCropWidth(display, aspect);
  const min = minCropWidth(display, aspect);
  return max > min ? ((max - width) / (max - min)) * 100 : 0;
}

/** The inverse: the box width a slider position asks for. */
export function widthForZoom(percent: number, display: Size, aspect: number): number {
  const max = maxCropWidth(display, aspect);
  const min = minCropWidth(display, aspect);
  const zoom = Math.max(0, Math.min(percent, 100)) / 100;
  return max - zoom * (max - min);
}

/**
 * The region of the *source* the crop selects, in real pixels -- what the
 * canvas draws from, and the resolution the readout reports.
 */
export function sourceRect(
  crop: Crop,
  natural: Size,
  display: Size,
  aspect: number
): { sx: number; sy: number; sw: number; sh: number } {
  // Uniform: the preview keeps the source's aspect.
  const scale = display.width > 0 ? natural.width / display.width : 0;
  return {
    sx: crop.x * scale,
    sy: crop.y * scale,
    sw: crop.width * scale,
    sh: (crop.width / aspect) * scale
  };
}

export type UploadPort = (file: File) => Promise<any>;

/**
 * The upload service is reached at the point of use rather than imported at
 * module scope. It pulls in the GraphQL multipart layer and, through it,
 * `import.meta.env` -- so a static import would make this module (and the crop
 * maths above, which is the part most worth testing) unloadable outside a Vite
 * build.
 */
const browserUploads: Record<ProfileImageVariant, UploadPort> = {
  avatar: (file) => import('../../services/api/upload').then((m) => m.uploadProfileImage(file)),
  banner: (file) => import('../../services/api/upload').then((m) => m.uploadBannerImage(file))
};

/** The two cache writes this makes after a successful upload. */
export interface QueryCachePort {
  setQueryData: (key: unknown[], updater: (previous: any) => any) => void;
  invalidateQueries: (filters: { queryKey: unknown[] }) => void;
}

/** `window.innerWidth`/`innerHeight`, so the preview can be fitted without one. */
export type ViewportPort = () => Size;

/** `setTimeout`, so the confirmation beat can be driven synchronously in a test. */
export type DelayPort = (callback: () => void, ms: number) => void;

export interface ProfileImageUploadInputs {
  readonly variant: ProfileImageVariant;
  /** The TanStack client the page owns; the upload writes the new URL into it. */
  readonly cache: QueryCachePort | undefined;
  /** The cropper asked to be dismissed -- cancelled, or done. */
  readonly onClose?: () => void;
}

export interface ProfileImageUploadDeps {
  uploads?: Record<ProfileImageVariant, UploadPort>;
  viewport?: ViewportPort;
  delay?: DelayPort;
}

const browserViewport: ViewportPort = () =>
  typeof window === 'undefined'
    ? { width: 1024, height: 768 }
    : { width: window.innerWidth, height: window.innerHeight };

/**
 * Framing and uploading a profile picture or banner.
 *
 * The view is left with the frame, the scrim and the slider; every number
 * under them -- the fit, the box, the zoom, the kept resolution, the source
 * rectangle the canvas draws from -- is computed here by the pure functions
 * above, and the upload itself goes through injected ports.
 */
export class ProfileImageUploadBloc {
  readonly #inputs: ProfileImageUploadInputs;
  readonly #uploads: Record<ProfileImageVariant, UploadPort>;
  readonly #viewport: ViewportPort;
  readonly #delay: DelayPort;

  #previewUrl = $state<string | null>(null);
  #naturalSize = $state<Size>({ width: 0, height: 0 });
  /** On-screen display size. */
  #imageSize = $state<Size>({ width: 0, height: 0 });
  #crop = $state<Crop>({ x: 0, y: 0, width: 0 });
  #isDragging = $state(false);
  #dragStart = { x: 0, y: 0 };
  /** A file is over the dropzone. */
  #dragActive = $state(false);
  #justSaved = $state(false);
  #isUploading = $state(false);
  /**
   * Shown to the user when an upload fails. A console line is compiled out of
   * production, so a failure reported only there is reported to nobody.
   */
  #uploadError = $state<string | null>(null);

  constructor(inputs: ProfileImageUploadInputs, deps: ProfileImageUploadDeps = {}) {
    this.#inputs = inputs;
    this.#uploads = deps.uploads ?? browserUploads;
    this.#viewport = deps.viewport ?? browserViewport;
    this.#delay = deps.delay ?? ((callback, ms) => setTimeout(callback, ms));
  }

  get preset(): VariantPreset {
    return PRESETS[this.#inputs.variant];
  }

  get variant(): ProfileImageVariant {
    return this.#inputs.variant;
  }

  get previewUrl(): string | null {
    return this.#previewUrl;
  }

  get imageSize(): Size {
    return this.#imageSize;
  }

  get crop(): Crop {
    return this.#crop;
  }

  get cropHeight(): number {
    return this.#crop.width / this.preset.aspect;
  }

  get dragActive(): boolean {
    return this.#dragActive;
  }

  get justSaved(): boolean {
    return this.#justSaved;
  }

  get isUploading(): boolean {
    return this.#isUploading;
  }

  get uploadError(): string | null {
    return this.#uploadError;
  }

  get zoomPercent(): number {
    return zoomPercent(this.#crop.width, this.#imageSize, this.preset.aspect);
  }

  /** The zoom factor, as the readout prints it. */
  get zoomFactor(): number {
    const max = maxCropWidth(this.#imageSize, this.preset.aspect);
    return this.#crop.width > 0 ? max / this.#crop.width : 1;
  }

  /**
   * The actual resolution being kept from the source, in real pixels -- the one
   * number that tells the viewer whether their crop will be sharp.
   */
  get keptSize(): { width: number; height: number } {
    const { sw } = sourceRect(this.#crop, this.#naturalSize, this.#imageSize, this.preset.aspect);
    const width = Math.round(sw);
    return { width, height: Math.round(width / this.preset.aspect) };
  }

  /** `Button`'s status for the Save control. */
  get saveStatus(): 'idle' | 'loading' | 'error' {
    if (this.#isUploading) return 'loading';
    return this.#uploadError ? 'error' : 'idle';
  }

  // ── Intents ───────────────────────────────────────────────────

  close(): void {
    this.#inputs.onClose?.();
    this.reset();
  }

  reset(): void {
    this.#previewUrl = null;
    this.#uploadError = null;
    this.#justSaved = false;
    this.#isUploading = false;
    this.#naturalSize = { width: 0, height: 0 };
    this.#imageSize = { width: 0, height: 0 };
    this.#crop = { x: 0, y: 0, width: 0 };
  }

  setDragActive(active: boolean): void {
    this.#dragActive = active;
  }

  /** A chosen or dropped file. Anything that is not an image is ignored. */
  acceptFile(file: File | null | undefined): void {
    this.#dragActive = false;
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      const image = new Image();
      image.onload = () => this.useImage(url, { width: image.width, height: image.height });
      image.src = url;
    };
    reader.readAsDataURL(file);
  }

  /**
   * Takes a loaded picture: checks it is big enough, fits it to the modal and
   * opens the crop centred. Public and separate from the FileReader plumbing
   * above so a story or a test can drive the sizing with two numbers.
   */
  useImage(url: string, natural: Size): void {
    const preset = this.preset;
    // Reject anything too small to produce a crisp result rather than
    // silently upscaling it into a blurry one.
    if (natural.width < preset.min.w || natural.height < preset.min.h) {
      this.#uploadError = `That image is ${natural.width}×${natural.height}. Use one at least ${preset.min.w}×${preset.min.h}.`;
      return;
    }

    const viewport = this.#viewport();
    const area = {
      width: viewport.width > 640 ? 600 : viewport.width - 80,
      height: viewport.height * (preset.circular ? 0.46 : 0.42)
    };

    this.#uploadError = null;
    this.#previewUrl = url;
    this.#naturalSize = natural;
    this.#imageSize = fitPreview(natural, area);
    this.#crop = initialCrop(this.#imageSize, preset.aspect);
  }

  startDrag(point: { x: number; y: number }): void {
    this.#isDragging = true;
    this.#dragStart = { x: point.x - this.#crop.x, y: point.y - this.#crop.y };
  }

  dragTo(point: { x: number; y: number }): void {
    if (!this.#isDragging) return;
    this.#crop = clampCrop(
      { ...this.#crop, x: point.x - this.#dragStart.x, y: point.y - this.#dragStart.y },
      this.#imageSize,
      this.preset.aspect
    );
  }

  endDrag(): void {
    this.#isDragging = false;
  }

  /** Arrow keys nudge the crop, so positioning is not mouse-only. */
  nudge(dx: number, dy: number): void {
    this.#crop = clampCrop(
      { ...this.#crop, x: this.#crop.x + dx, y: this.#crop.y + dy },
      this.#imageSize,
      this.preset.aspect
    );
  }

  setZoom(percent: number): void {
    const width = widthForZoom(percent, this.#imageSize, this.preset.aspect);
    this.#crop = clampCrop({ ...this.#crop, width }, this.#imageSize, this.preset.aspect);
  }

  /** Throws the current picture away and reopens the file picker. */
  chooseNewImage(pick: () => void): void {
    this.reset();
    pick();
  }

  /**
   * Draws the kept region into the canvas at the variant's output size and
   * uploads it. The canvas comes from the view because only the view can bind
   * one; everything about what to draw is decided here.
   */
  async save(canvas: HTMLCanvasElement | undefined): Promise<void> {
    const url = this.#previewUrl;
    if (!url || !canvas) return;
    this.#uploadError = null;

    const blob = await this.#render(canvas, url);
    if (!blob) {
      this.#uploadError = 'Could not process that image. Try a different file.';
      return;
    }

    const preset = this.preset;
    const file = new File([blob], preset.fileName, { type: 'image/jpeg' });
    this.#isUploading = true;
    try {
      const data = await this.#uploads[this.#inputs.variant](file);
      this.#uploadError = null;
      // Merge rather than replace, so uploading one image does not drop the
      // other's URL from the cached user.
      this.#inputs.cache?.setQueryData(['user'], (previous: any) => ({
        ...(previous ?? {}),
        ...data
      }));
      this.#inputs.cache?.invalidateQueries({ queryKey: ['user'] });
      // A beat of confirmation before the modal leaves, so the commit is not
      // just a spinner and then silence at the highest-stakes moment.
      this.#justSaved = true;
      this.#delay(() => this.close(), 900);
    } catch (error: any) {
      console.error('Failed to upload image:', error);
      this.#uploadError = error?.message
        ? `Upload failed: ${error.message}`
        : 'Upload failed. Please try again.';
    } finally {
      this.#isUploading = false;
    }
  }

  #render(canvas: HTMLCanvasElement, url: string): Promise<Blob | null> {
    const preset = this.preset;
    const context = canvas.getContext('2d');
    if (!context) return Promise.resolve(null);

    const { sx, sy, sw, sh } = sourceRect(
      this.#crop,
      this.#naturalSize,
      this.#imageSize,
      preset.aspect
    );

    return new Promise((resolve) => {
      const image = new Image();
      image.onerror = () => resolve(null);
      image.onload = () => {
        canvas.width = preset.output.w;
        canvas.height = preset.output.h;

        context.save();
        if (preset.circular) {
          // Clip the export to a circle for the avatar; the export is JPEG with
          // no alpha, so anything outside would otherwise fill black.
          context.beginPath();
          context.arc(preset.output.w / 2, preset.output.h / 2, preset.output.w / 2, 0, Math.PI * 2);
          context.clip();
        }
        context.drawImage(image, sx, sy, sw, sh, 0, 0, preset.output.w, preset.output.h);
        context.restore();

        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9);
      };
      image.src = url;
    });
  }
}
