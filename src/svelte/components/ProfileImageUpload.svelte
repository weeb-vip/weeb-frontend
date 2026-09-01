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
   * They are the same interaction -- pick a file, drag and zoom a crop box,
   * export it -- differing only in the box's shape and where the result goes. So
   * `variant` switches the aspect (a square vs a 4:1 strip), whether the export
   * is clipped to a circle, the output size, and which upload it calls, rather
   * than a second component copying the drag maths.
   */
  export let variant: 'avatar' | 'banner' = 'avatar';

  const PRESETS = {
    avatar: {
      aspect: 1,
      circular: true,
      output: { w: 800, h: 800 },
      min: { w: 0, h: 0 },
      title: 'Upload profile picture',
      fileName: 'profile.jpg',
      upload: uploadProfileImage,
    },
    banner: {
      aspect: 4,
      circular: false,
      output: { w: 1600, h: 400 },
      min: { w: 800, h: 200 },
      title: 'Upload banner',
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
      handleClose();
    },
    onError: (error: any) => {
      debug.error('Failed to upload image:', error);
      uploadError = error?.message ? `Upload failed: ${error.message}` : 'Upload failed. Please try again.';
    }
  }, queryClient);

  function resetState() {
    previewUrl = null;
    uploadError = null;
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
        const maxH = window.innerHeight * (preset.circular ? 0.5 : 0.45);
        let dw = img.width;
        let dh = img.height;
        if (dw > maxW || dh > maxH) {
          const scale = Math.min(maxW / dw, maxH / dh);
          dw *= scale;
          dh *= scale;
        }
        imageSize = { width: dw, height: dh };

        // Start with the largest box of the right aspect that fits, centred.
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
  $: sliderProgress = maxCropWidth > minCropWidth
    ? ((crop.width - minCropWidth) / (maxCropWidth - minCropWidth)) * 100
    : 0;

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

  function handleSizeChange(event: Event) {
    const w = Math.max(minCropWidth, Math.min(Number((event.target as HTMLInputElement).value), maxCropWidth));
    const h = w / preset.aspect;
    crop = {
      width: w,
      x: Math.min(crop.x, Math.max(0, imageSize.width - w)),
      y: Math.min(crop.y, Math.max(0, imageSize.height - h))
    };
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

      // Map the on-screen crop back onto the natural image (scale is uniform;
      // the preview preserves aspect).
      const scale = naturalSize.width / imageSize.width;
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

      // A null blob used to return silently, which looked exactly like a
      // successful click that did nothing -- mutate() was never called.
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
  <div class="flex flex-col h-full">
    <h3 class="text-lg font-medium leading-6 text-weeb-fg mb-4">{preset.title}</h3>

    <div class="flex-1 overflow-y-auto">
      {#if !previewUrl}
        <div
          class="border-2 border-dashed border-weeb-border rounded-lg p-6 sm:p-8 text-center cursor-pointer hover:border-weeb-accent transition-colors"
          on:drop={handleDrop}
          on:dragover={(e) => e.preventDefault()}
          on:click={() => fileInput?.click()}
          on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput?.click(); } }}
          role="button"
          tabindex="0"
          aria-label={preset.title}
        >
          <svg class="mx-auto h-8 w-8 sm:h-12 sm:w-12 text-weeb-fg-muted" stroke="currentColor" fill="none" viewBox="0 0 48 48">
            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <p class="mt-2 text-sm text-weeb-fg-muted">Tap to upload or drag and drop</p>
          <p class="text-xs text-weeb-fg-muted">
            {#if variant === 'banner'}Wide image, at least {preset.min.w}×{preset.min.h}. PNG, JPG, WEBP.{:else}PNG, JPG, GIF up to 10MB{/if}
          </p>
          <input bind:this={fileInput} type="file" class="hidden" accept="image/*" on:change={handleFileSelect} />
        </div>
      {:else}
        <div class="space-y-4">
          <div class="flex justify-center">
            <div class="relative select-none" style="width: {imageSize.width}px; height: {imageSize.height}px; max-width: 100%;">
              <img src={previewUrl} alt="Preview" class="block" style="width: {imageSize.width}px; height: {imageSize.height}px;" draggable="false" />
              <!-- Crop box; the box-shadow darkens everything outside it, and its
                   own border-radius makes that mask circular for the avatar. -->
              <div
                class="absolute border-2 border-white cursor-move touch-manipulation {preset.circular ? 'rounded-full' : ''}"
                style="left: {crop.x}px; top: {crop.y}px; width: {crop.width}px; height: {cropHeight}px; box-shadow: 0 0 0 9999px rgba(0,0,0,0.5);"
                on:mousedown={handleStart}
                on:touchstart={handleStart}
                role="button"
                tabindex="0"
                aria-label="Drag to position the crop"
              >
                <div class="absolute inset-0 border border-dashed border-white/50 pointer-events-none {preset.circular ? 'rounded-full' : ''}"></div>
              </div>
            </div>
          </div>

          <div class="space-y-3 px-4">
            <label for="crop-size-slider" class="text-sm font-medium text-weeb-fg-secondary block text-center">Zoom</label>
            <div class="px-6">
              <div class="relative bg-weeb-surface h-6 rounded-full">
                <div class="absolute top-0 left-0 h-full bg-weeb-accent rounded-full" style="width: {sliderProgress}%;"></div>
                <input
                  id="crop-size-slider"
                  type="range"
                  min={minCropWidth}
                  max={maxCropWidth}
                  value={crop.width}
                  on:input={handleSizeChange}
                  class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div class="absolute top-1/2 -translate-y-1/2 w-8 h-8 bg-weeb-accent border-4 border-white rounded-full shadow-lg pointer-events-none" style="left: {sliderProgress}%; transform: translateX(-50%) translateY(-50%);"></div>
              </div>
            </div>
            <p class="text-xs text-weeb-fg-muted text-center">Drag the box to choose which part shows, or use the slider to zoom.</p>
          </div>

          <div class="flex justify-center">
            <Button color="transparent" label="Choose Different Image" onClick={chooseNewImage} showLabel={true} />
          </div>
        </div>
      {/if}
    </div>

    <canvas bind:this={canvas} class="hidden"></canvas>

    {#if uploadError}
      <div class="mt-4 rounded-lg border border-weeb-red/40 bg-weeb-red/10 px-4 py-3 text-sm text-weeb-red" role="alert">
        {uploadError}
      </div>
    {/if}

    <div class="mt-6 flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3">
      <Button color="transparent" label="Cancel" onClick={handleClose} showLabel={true} className="w-full sm:w-auto" />
      {#if previewUrl}
        <Button
          color="blue"
          label={$uploadMutation.isPending ? 'Uploading...' : 'Upload'}
          onClick={cropAndUpload}
          showLabel={true}
          status={$uploadMutation.isPending ? 'loading' : uploadError ? 'error' : 'idle'}
          className="w-full sm:w-auto"
        />
      {/if}
    </div>
  </div>
</Modal>
