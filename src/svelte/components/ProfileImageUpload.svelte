<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { createMutation } from '@tanstack/svelte-query';
  import { uploadProfileImage } from '../../services/api/upload';
  import Modal from './Modal.svelte';
  import Button from './Button.svelte';
  import debug from '../../utils/debug';

  export let isOpen = false;
  export let queryClient: any;

  const dispatch = createEventDispatcher();

  let selectedFile: File | null = null;
  let previewUrl: string | null = null;
  let cropData = { x: 0, y: 0, size: 200 };
  let isDragging = false;
  let dragStart = { x: 0, y: 0 };
  let imageSize = { width: 0, height: 0 };
  let fileInput: HTMLInputElement;
  let canvas: HTMLCanvasElement;
  /** Shown to the user when an upload fails. debug.* is compiled out of
      production (it gates on import.meta.env.DEV), so anything reported only
      through it is reported to nobody. */
  let uploadError: string | null = null;

  const uploadMutation = createMutation({
    mutationFn: async (croppedBlob: Blob) => {
      debug.info('Starting profile image upload...', {
        blobSize: croppedBlob.size,
        blobType: croppedBlob.type
      });

      const file = new File([croppedBlob], 'profile.jpg', { type: 'image/jpeg' });
      debug.info('Created file from blob:', {
        name: file.name,
        type: file.type,
        size: file.size
      });

      return await uploadProfileImage(file);
    },
    onSuccess: (data) => {
      debug.success('Profile image uploaded successfully', data);
      uploadError = null;
      queryClient.setQueryData(['user'], data);
      queryClient.invalidateQueries({ queryKey: ['user'] });
      handleClose();
      resetState();
    },
    onError: (error: any) => {
      debug.error('Failed to upload profile image:', error);
      uploadError = error?.message
        ? `Upload failed: ${error.message}`
        : 'Upload failed. Please try again.';
    }
  }, queryClient);

  function resetState() {
    selectedFile = null;
    previewUrl = null;
    uploadError = null;
    cropData = { x: 0, y: 0, size: 200 };
    imageSize = { width: 0, height: 0 };
  }

  function handleClose() {
    dispatch('close');
    resetState();
  }

  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processFile(file);
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (file && file.type.startsWith('image/')) {
      processFile(file);
    }
  }

  function processFile(file: File) {
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      previewUrl = url;

      // Load image to get dimensions
      const img = new Image();
      img.onload = () => {
        // Scale image dimensions to fit within container
        const containerMaxWidth = window.innerWidth > 640 ? 600 : window.innerWidth - 80;
        const containerMaxHeight = window.innerHeight * 0.5;

        let displayWidth = img.width;
        let displayHeight = img.height;

        // Scale down if image is too large
        if (displayWidth > containerMaxWidth || displayHeight > containerMaxHeight) {
          const scale = Math.min(containerMaxWidth / displayWidth, containerMaxHeight / displayHeight);
          displayWidth *= scale;
          displayHeight *= scale;
        }

        imageSize = { width: displayWidth, height: displayHeight };
        // Bounded by the shorter side for the same reason as the slider. This
        // took the LONGER one, so a wide image opened with a crop taller than
        // itself and a negative y before the slider was touched at all.
        const cropSize = Math.min(displayWidth, displayHeight, 300);
        cropData = {
          x: (displayWidth - cropSize) / 2,
          y: (displayHeight - cropSize) / 2,
          size: cropSize
        };
      };
      img.src = url;
    };
    reader.readAsDataURL(file);
  }

  function handleStart(event: MouseEvent | TouchEvent) {
    isDragging = true;
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
    dragStart = { x: clientX - cropData.x, y: clientY - cropData.y };
  }

  function handleMove(event: MouseEvent | TouchEvent) {
    if (!isDragging) return;

    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;

    const newX = Math.max(0, Math.min(clientX - dragStart.x, imageSize.width - cropData.size));
    const newY = Math.max(0, Math.min(clientY - dragStart.y, imageSize.height - cropData.size));

    cropData = { ...cropData, x: newX, y: newY };
  }

  function handleEnd() {
    isDragging = false;
  }

  function handleSizeChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const newSize = Number(target.value);
    const size = Math.max(minCropSize, Math.min(newSize, maxCropSize));
    const maxX = Math.max(0, imageSize.width - size);
    const maxY = Math.max(0, imageSize.height - size);

    cropData = {
      size,
      x: Math.min(cropData.x, maxX),
      y: Math.min(cropData.y, maxY)
    };
  }

  async function cropAndUpload() {
    if (!previewUrl || !canvas) return;
    uploadError = null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      // The stored original. Larger than the on-screen crop so the profile
      // page and public page have a sharp image to show; the 32/64 thumbnails
      // are still derived from it for the small avatars.
      const OUTPUT = 800;
      canvas.width = OUTPUT;
      canvas.height = OUTPUT;

      // Calculate scale factors
      const displayToOriginalScaleX = img.width / imageSize.width;
      const displayToOriginalScaleY = img.height / imageSize.height;

      // Calculate original image crop coordinates
      const originalCropX = cropData.x * displayToOriginalScaleX;
      const originalCropY = cropData.y * displayToOriginalScaleY;
      const originalCropSize = cropData.size * Math.min(displayToOriginalScaleX, displayToOriginalScaleY);

      // Create circular clipping path
      ctx.save();
      ctx.beginPath();
      ctx.arc(OUTPUT / 2, OUTPUT / 2, OUTPUT / 2, 0, Math.PI * 2);
      ctx.clip();

      // Draw cropped and scaled image within the circular clip
      ctx.drawImage(
        img,
        originalCropX, originalCropY, originalCropSize, originalCropSize,
        0, 0, OUTPUT, OUTPUT
      );

      ctx.restore();

      // Convert to blob.
      //
      // A null blob used to return silently, which looked exactly like a
      // successful click that did nothing -- the button never even entered its
      // pending state, because mutate() was never called.
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

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
  }

  function openFileDialog() {
    fileInput?.click();
  }

  function handleDropzoneKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openFileDialog();
    }
  }

  function chooseNewImage() {
    resetState();
    fileInput?.click();
  }

  // The crop is a square, so the largest one that fits is bounded by the
  // SHORTER side. This was Math.max, which let the square exceed the image on
  // its short axis: at full size on a 600x400 the crop ran 200px past the
  // bottom, and drawImage filled the overhang with transparent black -- a solid
  // band across the avatar, since the export is JPEG and has no alpha.
  $: maxCropSize = Math.min(imageSize.width, imageSize.height);
  $: minCropSize = maxCropSize * 0.5;

  // Calculate slider progress percentage
  $: sliderProgress = imageSize.width && imageSize.height && maxCropSize > minCropSize ?
    ((cropData.size - minCropSize) / (maxCropSize - minCropSize)) * 100 : 0;
</script>

<svelte:window on:mousemove={handleMove} on:mouseup={handleEnd} />

<Modal {isOpen} on:close={handleClose} className="max-w-2xl max-h-[90vh]">
  <div class="flex flex-col h-full">
    <h3 class="text-lg font-medium leading-6 text-weeb-fg mb-4">
      Upload Profile Picture
    </h3>

    <div class="flex-1 overflow-y-auto">
      {#if !previewUrl}
        <div
          class="border-2 border-dashed border-weeb-border rounded-lg p-6 sm:p-8 text-center cursor-pointer hover:border-weeb-accent transition-colors"
          on:drop={handleDrop}
          on:dragover={handleDragOver}
          on:click={openFileDialog}
          on:keydown={handleDropzoneKeydown}
          role="button"
          tabindex="0"
          aria-label="Upload profile picture"
        >
          <svg class="mx-auto h-8 w-8 sm:h-12 sm:w-12 text-weeb-fg-muted" stroke="currentColor" fill="none" viewBox="0 0 48 48">
            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <p class="mt-2 text-sm text-weeb-fg-muted">
            Tap to upload or drag and drop
          </p>
          <p class="text-xs text-weeb-fg-muted">
            PNG, JPG, GIF up to 10MB
          </p>
          <input
            bind:this={fileInput}
            type="file"
            class="hidden"
            accept="image/*"
            on:change={handleFileSelect}
          />
        </div>
      {:else}
        <div class="space-y-4">
          <div class="flex justify-center">
            <div
              class="relative select-none"
              style="width: {imageSize.width}px; height: {imageSize.height}px; max-width: 100%;"
            >
              <img
                src={previewUrl}
                alt="Preview"
                class="block"
                style="width: {imageSize.width}px; height: {imageSize.height}px;"
                draggable="false"
              />
              <!-- Circular crop area -->
              <div
                class="absolute border-2 border-white shadow-lg pointer-events-none rounded-full"
                style="left: {cropData.x}px; top: {cropData.y}px; width: {cropData.size}px; height: {cropData.size}px;"
              >
                <div class="absolute inset-0 border border-dashed border-white/50 rounded-full"></div>
                <div
                  class="absolute inset-0 cursor-move pointer-events-auto touch-manipulation rounded-full"
                  on:mousedown={handleStart}
                  on:touchstart={handleStart}
                  role="button"
                  tabindex="0"
                ></div>
              </div>
              <!-- Circular overlay for darkening outside crop -->
              <div
                class="absolute inset-0 pointer-events-none"
                style="background: radial-gradient(circle at {cropData.x + cropData.size/2}px {cropData.y + cropData.size/2}px, transparent {cropData.size/2}px, rgba(0,0,0,0.5) {cropData.size/2}px);"
              ></div>
            </div>
          </div>

          <div class="space-y-4 px-4">
            <label for="crop-size-slider" class="text-sm font-medium text-weeb-fg-secondary block text-center">
              Crop Size: {Math.round(cropData.size)}px
            </label>
            <div class="px-6 py-4">
              <div class="relative bg-weeb-surface h-6 rounded-full">
                <!-- Progress track -->
                <div
                  class="absolute top-0 left-0 h-full bg-weeb-accent rounded-full"
                  style="width: {sliderProgress}%;"
                ></div>
                <!-- Hidden native slider -->
                <input
                  id="crop-size-slider"
                  type="range"
                  min={minCropSize}
                  max={maxCropSize}
                  value={cropData.size}
                  on:input={handleSizeChange}
                  class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <!-- Custom thumb -->
                <div
                  class="absolute top-1/2 -translate-y-1/2 w-8 h-8 bg-weeb-accent border-4 border-white rounded-full shadow-lg pointer-events-none"
                  style="left: {sliderProgress}%; transform: translateX(-50%) translateY(-50%);"
                ></div>
              </div>
            </div>
            <p class="text-xs text-weeb-fg-muted text-center">
              Drag the circle above to position, or use the slider to resize
            </p>
          </div>

          <div class="flex justify-center">
            <Button
              color="transparent"
              label="Choose Different Image"
              onClick={chooseNewImage}
              showLabel={true}
            />
          </div>
        </div>
      {/if}
    </div>

    <canvas bind:this={canvas} class="hidden"></canvas>

    {#if uploadError}
      <div
        class="mt-4 rounded-lg border border-weeb-red/40 bg-weeb-red/10 px-4 py-3 text-sm text-weeb-red"
        role="alert"
      >
        {uploadError}
      </div>
    {/if}

    <div class="mt-6 flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3">
      <Button
        color="transparent"
        label="Cancel"
        onClick={handleClose}
        showLabel={true}
        className="w-full sm:w-auto"
      />
      {#if previewUrl}
        <Button
          color="blue"
          label={$uploadMutation.isPending ? "Uploading..." : "Upload"}
          onClick={cropAndUpload}
          showLabel={true}
          status={$uploadMutation.isPending ? "loading" : uploadError ? "error" : "idle"}
          className="w-full sm:w-auto"
        />
      {/if}
    </div>
  </div>
</Modal>