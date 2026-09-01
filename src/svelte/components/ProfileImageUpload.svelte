<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { createMutation } from '@tanstack/svelte-query';
  import { uploadProfileImage, uploadBannerImage } from '../../services/api/upload';
  import Modal from './Modal.svelte';
  import Button from './Button.svelte';
  import debug from '../../utils/debug';

  export let isOpen = false;
  export let queryClient: any;

  /**
   * One cropper for both the avatar and the banner.
   *
   * They are the same interaction -- pick a file, frame a crop, export it --
   * differing only in the box's shape and where the result goes. So `variant`
   * switches the aspect (a square vs a 4:1 strip), whether the export is clipped
   * to a circle, the output size, the minimum accepted source, and which upload
   * it calls, rather than a second component copying the drag maths.
   */
  export let variant: 'avatar' | 'banner' = 'avatar';

  const PRESETS = {
    avatar: {
      aspect: 1,
      circular: true,
      output: { w: 800, h: 800 },
      min: { w: 400, h: 400 },
      title: 'Frame your picture',
      fileName: 'profile.jpg',
      upload: uploadProfileImage,
    },
    banner: {
      aspect: 4,
      circular: false,
      output: { w: 1600, h: 400 },
      min: { w: 800, h: 200 },
      title: 'Frame your banner',
      fileName: 'banner.jpg',
      upload: uploadBannerImage,
    },
  } as const;

  $: preset = PRESETS[variant];

  const dispatch = createEventDispatcher();

  let previewUrl: string | null = null;
  let naturalSize = { width: 0, height: 0 };
  let imageSize = { width: 0, height: 0 }; // on-screen display size
  // The crop is stored by its width; height is derived from the variant's
  // aspect, so a square and a strip are the same state.
  let crop = { x: 0, y: 0, width: 0 };
  let isDragging = false;
  let dragStart = { x: 0, y: 0 };
  let dragActive = false; // a file is over the dropzone
  let justSaved = false;
  let fileInput: HTMLInputElement;
  let canvas: HTMLCanvasElement;
  /** Shown to the user when an upload fails. debug.* is compiled out of
      production, so anything reported only through it is reported to nobody. */
  let uploadError: string | null = null;

  const uploadMutation = createMutation({
    mutationFn: async (blob: Blob) => {
      const file = new File([blob], preset.fileName, { type: 'image/jpeg' });
      return await preset.upload(file);
    },
    onSuccess: (data) => {
      uploadError = null;
      // Merge rather than replace, so uploading one image does not drop the
      // other's URL from the cached user.
      queryClient.setQueryData(['user'], (prev: any) => ({ ...(prev ?? {}), ...data }));
      queryClient.invalidateQueries({ queryKey: ['user'] });
      // A beat of confirmation before the modal leaves, so the commit is not
      // just a spinner and then silence at the highest-stakes moment.
      justSaved = true;
      setTimeout(handleClose, 900);
    },
    onError: (error: any) => {
      debug.error('Failed to upload image:', error);
      uploadError = error?.message ? `Upload failed: ${error.message}` : 'Upload failed. Please try again.';
    }
  }, queryClient);

  function resetState() {
    previewUrl = null;
    uploadError = null;
    justSaved = false;
    naturalSize = { width: 0, height: 0 };
    imageSize = { width: 0, height: 0 };
    crop = { x: 0, y: 0, width: 0 };
  }

  function handleClose() {
    dispatch('close');
    resetState();
  }

  function handleFileSelect(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file && file.type.startsWith('image/')) processFile(file);
  }
  function handleDrop(event: DragEvent) {
    event.preventDefault();
    dragActive = false;
    const file = event.dataTransfer?.files[0];
    if (file && file.type.startsWith('image/')) processFile(file);
  }

  function processFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        // Reject anything too small to produce a crisp result rather than
        // silently upscaling it into a blurry one.
        if (img.width < preset.min.w || img.height < preset.min.h) {
          uploadError = `That image is ${img.width}×${img.height}. Use one at least ${preset.min.w}×${preset.min.h}.`;
          return;
        }
        uploadError = null;
        previewUrl = url;
        naturalSize = { width: img.width, height: img.height };

        // Fit the preview into the modal.
        const maxW = window.innerWidth > 640 ? 600 : window.innerWidth - 80;
        const maxH = window.innerHeight * (preset.circular ? 0.46 : 0.42);
        let dw = img.width;
        let dh = img.height;
        if (dw > maxW || dh > maxH) {
          const scale = Math.min(maxW / dw, maxH / dh);
          dw *= scale;
          dh *= scale;
        }
        imageSize = { width: dw, height: dh };

        // Open zoomed out: the largest box of the right aspect that fits, centred.
        const w = Math.min(dw, dh * preset.aspect);
        crop = { width: w, x: (dw - w) / 2, y: (dh - w / preset.aspect) / 2 };
      };
      img.src = url;
    };
    reader.readAsDataURL(file);
  }

  $: cropHeight = crop.width / preset.aspect;
  // Width is the binding dimension: the largest box of this aspect that fits is
  // the one whose height is the image height (or whose width is the image width,
  // whichever is smaller).
  $: maxCropWidth = Math.min(imageSize.width, imageSize.height * preset.aspect);
  $: minCropWidth = maxCropWidth * 0.5;
  // Zoom, not box size: a smaller box means a tighter frame, so 100% is the
  // smallest box (most zoomed in). Right on the slider is more zoom, which is
  // what every zoom control does.
  $: zoomPct = maxCropWidth > minCropWidth
    ? ((maxCropWidth - crop.width) / (maxCropWidth - minCropWidth)) * 100
    : 0;
  $: zoomX = crop.width > 0 ? maxCropWidth / crop.width : 1;
  // The actual resolution being kept from the source, in real pixels -- the one
  // number that tells the viewer whether their crop will be sharp.
  $: keptW = imageSize.width > 0 ? Math.round(crop.width * (naturalSize.width / imageSize.width)) : 0;
  $: keptH = Math.round(keptW / preset.aspect);

  function handleStart(event: MouseEvent | TouchEvent) {
    isDragging = true;
    const cx = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const cy = 'touches' in event ? event.touches[0].clientY : event.clientY;
    dragStart = { x: cx - crop.x, y: cy - crop.y };
  }
  function handleMove(event: MouseEvent | TouchEvent) {
    if (!isDragging) return;
    const cx = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const cy = 'touches' in event ? event.touches[0].clientY : event.clientY;
    const x = Math.max(0, Math.min(cx - dragStart.x, imageSize.width - crop.width));
    const y = Math.max(0, Math.min(cy - dragStart.y, imageSize.height - cropHeight));
    crop = { ...crop, x, y };
  }
  function handleEnd() {
    isDragging = false;
  }

  // Arrow keys nudge the crop, so positioning is not mouse-only.
  function handleCropKeydown(event: KeyboardEvent) {
    const step = event.shiftKey ? 20 : 4;
    let { x, y } = crop;
    if (event.key === 'ArrowLeft') x -= step;
    else if (event.key === 'ArrowRight') x += step;
    else if (event.key === 'ArrowUp') y -= step;
    else if (event.key === 'ArrowDown') y += step;
    else return;
    event.preventDefault();
    crop = {
      ...crop,
      x: Math.max(0, Math.min(x, imageSize.width - crop.width)),
      y: Math.max(0, Math.min(y, imageSize.height - cropHeight)),
    };
  }

  function setWidth(w: number) {
    const width = Math.max(minCropWidth, Math.min(w, maxCropWidth));
    const h = width / preset.aspect;
    crop = {
      width,
      x: Math.min(crop.x, Math.max(0, imageSize.width - width)),
      y: Math.min(crop.y, Math.max(0, imageSize.height - h))
    };
  }
  function handleZoom(event: Event) {
    const z = Number((event.target as HTMLInputElement).value) / 100; // 0 out .. 1 in
    setWidth(maxCropWidth - z * (maxCropWidth - minCropWidth));
  }

  function chooseNewImage() {
    resetState();
    fileInput?.click();
  }

  async function cropAndUpload() {
    if (!previewUrl || !canvas) return;
    uploadError = null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = preset.output.w;
      canvas.height = preset.output.h;

      const scale = naturalSize.width / imageSize.width; // uniform; preview keeps aspect
      const sx = crop.x * scale;
      const sy = crop.y * scale;
      const sw = crop.width * scale;
      const sh = cropHeight * scale;

      ctx.save();
      if (preset.circular) {
        // Clip the export to a circle for the avatar; the export is JPEG with no
        // alpha, so anything outside would otherwise fill black.
        ctx.beginPath();
        ctx.arc(preset.output.w / 2, preset.output.h / 2, preset.output.w / 2, 0, Math.PI * 2);
        ctx.clip();
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, preset.output.w, preset.output.h);
      ctx.restore();

      canvas.toBlob((blob) => {
        if (blob) {
          uploadError = null;
          $uploadMutation.mutate(blob);
        } else {
          uploadError = 'Could not process that image. Try a different file.';
        }
      }, 'image/jpeg', 0.9);
    };
    img.src = previewUrl;
  }
</script>

<svelte:window on:mousemove={handleMove} on:mouseup={handleEnd} />

<Modal {isOpen} on:close={handleClose} className="max-w-2xl max-h-[90vh]">
  <div class="cropper">
    <h3 class="cropper-title">{preset.title}</h3>

    <div class="cropper-body">
      {#if !previewUrl}
        <div
          class="dropzone {dragActive ? 'is-active' : ''}"
          on:drop={handleDrop}
          on:dragover={(e) => { e.preventDefault(); dragActive = true; }}
          on:dragleave={() => (dragActive = false)}
          on:click={() => fileInput?.click()}
          on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput?.click(); } }}
          role="button"
          tabindex="0"
          aria-label={preset.title}
        >
          <svg class="dropzone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 15V3m0 0L8 7m4-4l4 4" />
            <path d="M20 15v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4" />
          </svg>
          <p class="dropzone-primary">{dragActive ? 'Drop to use this image' : 'Drop an image, or click to choose'}</p>
          <p class="dropzone-hint">
            PNG · JPG{#if variant === 'banner'} · WEBP{/if} &nbsp;·&nbsp; at least <span class="num">{preset.min.w}×{preset.min.h}</span>
          </p>
          <input bind:this={fileInput} type="file" class="hidden" accept="image/*" on:change={handleFileSelect} />
        </div>
      {:else}
        <div class="stage">
          <div class="frame-wrap" style="width: {imageSize.width}px; height: {imageSize.height}px; max-width: 100%;">
            <img src={previewUrl} alt="Preview" class="frame-img" style="width: {imageSize.width}px; height: {imageSize.height}px;" draggable="false" />
            <!-- The kept region: an accent frame is the one selection on screen,
                 the scrim outside darkens the rest so the kept picture is the
                 brightest thing -- the product's own rule, here too. -->
            <div
              class="crop {preset.circular ? 'crop--circle' : ''}"
              style="left: {crop.x}px; top: {crop.y}px; width: {crop.width}px; height: {cropHeight}px;"
              on:mousedown={handleStart}
              on:touchstart={handleStart}
              on:keydown={handleCropKeydown}
              role="button"
              tabindex="0"
              aria-label="Drag or arrow-key to position the crop"
            >
              {#if !preset.circular}
                <!-- Rule-of-thirds guides: a framing instrument, not decoration. -->
                <span class="guide guide--v" style="left: 33.33%"></span>
                <span class="guide guide--v" style="left: 66.66%"></span>
                <span class="guide guide--h" style="top: 33.33%"></span>
                <span class="guide guide--h" style="top: 66.66%"></span>
              {/if}
            </div>
          </div>

          <!-- Instrument row: the live resolution being kept, in mono, and a
               quiet zoom rail that lets Upload keep the accent. -->
          <div class="controls">
            <div class="readout">
              <span class="readout-label">Keeping</span>
              <span class="num readout-dims">{keptW}<span class="readout-x">×</span>{keptH}</span>
              <span class="num readout-zoom">{zoomX.toFixed(1)}×</span>
            </div>
            <div class="rail">
              <div class="rail-fill" style="width: {zoomPct}%"></div>
              <input
                class="rail-input"
                type="range"
                min="0"
                max="100"
                step="1"
                value={zoomPct}
                on:input={handleZoom}
                aria-label="Zoom"
              />
              <div class="rail-thumb" style="left: {zoomPct}%"></div>
            </div>
            <p class="controls-hint">Drag the frame to reposition · slider or arrow keys to fine-tune</p>
          </div>
        </div>
      {/if}
    </div>

    <canvas bind:this={canvas} class="hidden"></canvas>

    {#if uploadError}
      <div class="cropper-error" role="alert">{uploadError}</div>
    {/if}

    <div class="cropper-footer">
      {#if previewUrl && !justSaved}
        <button type="button" class="link-btn" on:click={chooseNewImage}>Choose different image</button>
      {:else}
        <span></span>
      {/if}
      <div class="footer-actions">
        {#if justSaved}
          <span class="saved">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10.5l3.2 3.2L15 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Saved
          </span>
        {:else}
          <Button color="transparent" label="Cancel" onClick={handleClose} showLabel={true} />
          {#if previewUrl}
            <Button
              color="blue"
              label={$uploadMutation.isPending ? 'Uploading…' : 'Save'}
              onClick={cropAndUpload}
              showLabel={true}
              status={$uploadMutation.isPending ? 'loading' : uploadError ? 'error' : 'idle'}
            />
          {/if}
        {/if}
      </div>
    </div>
  </div>
</Modal>

<style>
  .cropper {
    display: flex;
    flex-direction: column;
  }

  .cropper-title {
    margin: 0 0 18px;
    padding-right: 40px; /* clear the modal's close button */
    font-size: 1rem;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--weeb-fg);
  }

  .cropper-body {
    /* Content-height, not stretched: an empty dropzone must not pull the modal
       tall and leave a gap above the footer. The preview is pre-fit to the
       viewport, so overflow is only a safety net for an extreme case. */
    flex: 0 1 auto;
    min-height: 0;
    max-height: 68vh;
    overflow-y: auto;
  }

  /* ── Dropzone ─────────────────────────────────────────── */
  .dropzone {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 28px 24px;
    text-align: center;
    border: 1.5px dashed var(--weeb-border);
    border-radius: var(--weeb-radius-lg, 12px);
    background: var(--weeb-surface);
    cursor: pointer;
    transition: border-color 0.15s ease, background 0.15s ease;
  }
  .dropzone:hover,
  .dropzone:focus-visible {
    border-color: color-mix(in oklch, var(--weeb-accent) 55%, var(--weeb-border));
    outline: none;
  }
  /* A file is over the zone: the promise is confirmed at the moment of the
     gesture, which the plain hover never did. */
  .dropzone.is-active {
    border-color: var(--weeb-accent);
    border-style: solid;
    background: color-mix(in oklch, var(--weeb-accent) 8%, var(--weeb-surface));
  }
  .dropzone-icon {
    width: 34px;
    height: 34px;
    color: var(--weeb-fg-muted);
  }
  .dropzone.is-active .dropzone-icon {
    color: var(--weeb-accent-text);
  }
  .dropzone-primary {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--weeb-fg);
  }
  .dropzone-hint {
    margin: 0;
    font-size: 0.8rem;
    color: var(--weeb-fg-secondary);
  }

  /* ── Stage + crop frame ───────────────────────────────── */
  .stage {
    display: flex;
    flex-direction: column;
    gap: 20px;
    align-items: center;
    padding: 8px 0;
  }
  .frame-wrap {
    position: relative;
    user-select: none;
    border-radius: var(--weeb-radius, 8px);
    overflow: hidden;
  }
  .frame-img {
    display: block;
  }
  .crop {
    position: absolute;
    cursor: move;
    touch-action: none;
    border: 2px solid var(--weeb-accent);
    /* The scrim outside, and a soft accent lift on the frame so the kept
       picture reads as the brightest, most-alive thing in the modal. */
    box-shadow:
      0 0 0 9999px color-mix(in oklch, var(--weeb-bg) 62%, transparent),
      0 0 0 1px color-mix(in oklch, var(--weeb-bg) 90%, transparent) inset,
      0 8px 28px color-mix(in oklch, var(--weeb-accent) 35%, transparent);
    transition: box-shadow 0.2s ease;
  }
  .crop--circle {
    border-radius: var(--weeb-radius-full, 9999px);
  }
  .crop:focus-visible {
    outline: none;
    box-shadow:
      0 0 0 9999px color-mix(in oklch, var(--weeb-bg) 62%, transparent),
      0 0 0 3px color-mix(in oklch, var(--weeb-accent) 40%, transparent),
      0 8px 28px color-mix(in oklch, var(--weeb-accent) 45%, transparent);
  }
  .guide {
    position: absolute;
    background: color-mix(in oklch, var(--weeb-fg) 45%, transparent);
    pointer-events: none;
  }
  .guide--v { top: 0; bottom: 0; width: 1px; }
  .guide--h { left: 0; right: 0; height: 1px; }

  /* ── Instrument controls ──────────────────────────────── */
  .controls {
    width: 100%;
    max-width: 26rem;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .readout {
    display: flex;
    align-items: baseline;
    gap: 10px;
  }
  .num {
    font-family: var(--weeb-font-mono, monospace);
    font-variant-numeric: tabular-nums;
  }
  .readout-label {
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--weeb-fg-muted);
  }
  .readout-dims {
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--weeb-fg);
  }
  .readout-x {
    padding: 0 3px;
    color: var(--weeb-fg-muted);
  }
  .readout-zoom {
    margin-left: auto;
    font-size: 0.85rem;
    color: var(--weeb-accent-text);
  }

  /* Quiet rail: the track recedes so the accent stays on Save. The fill and
     thumb carry just enough accent to read as the live value. */
  .rail {
    position: relative;
    height: 6px;
    border-radius: var(--weeb-radius-full, 9999px);
    background: var(--weeb-surface-hover);
  }
  .rail-fill {
    position: absolute;
    inset: 0 auto 0 0;
    height: 100%;
    border-radius: inherit;
    background: color-mix(in oklch, var(--weeb-accent) 70%, transparent);
    pointer-events: none;
  }
  .rail-input {
    position: absolute;
    inset: -8px 0;
    width: 100%;
    height: calc(100% + 16px);
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }
  .rail-thumb {
    position: absolute;
    top: 50%;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--weeb-accent);
    box-shadow: 0 2px 8px color-mix(in oklch, var(--weeb-bg) 70%, transparent);
    transform: translate(-50%, -50%);
    pointer-events: none;
    transition: box-shadow 0.15s ease;
  }
  .rail-input:focus-visible ~ .rail-thumb {
    box-shadow: 0 0 0 4px color-mix(in oklch, var(--weeb-accent) 35%, transparent);
  }
  .controls-hint {
    margin: 0;
    font-size: 0.75rem;
    color: var(--weeb-fg-secondary);
    text-align: center;
  }

  /* ── Error + footer ───────────────────────────────────── */
  .cropper-error {
    margin-top: 16px;
    padding: 10px 14px;
    font-size: 0.85rem;
    color: var(--weeb-red);
    background: color-mix(in oklch, var(--weeb-red) 10%, transparent);
    border: 1px solid color-mix(in oklch, var(--weeb-red) 40%, transparent);
    border-radius: var(--weeb-radius, 8px);
  }

  .cropper-footer {
    margin-top: 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .footer-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .link-btn {
    background: none;
    border: none;
    padding: 0;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--weeb-fg-secondary);
    cursor: pointer;
    transition: color 0.15s ease;
  }
  .link-btn:hover {
    color: var(--weeb-accent-text);
  }
  .saved {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--weeb-green);
  }
  .saved svg {
    width: 18px;
    height: 18px;
  }

  .hidden { display: none; }

  @media (max-width: 640px) {
    .cropper-footer { flex-direction: column-reverse; align-items: stretch; gap: 14px; }
    .footer-actions { justify-content: flex-end; }
    .link-btn { text-align: center; }
  }
</style>
