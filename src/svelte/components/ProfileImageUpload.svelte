<script lang="ts">
  import Modal from './Modal.svelte';
  import Button from './Button.svelte';
  import {
    ProfileImageUploadBloc,
    type ProfileImageVariant,
    type QueryCachePort
  } from './ProfileImageUpload.bloc.svelte';

  let {
    isOpen = false,
    queryClient,
    variant = 'avatar',
    /** The cropper asked to be dismissed -- cancelled, or done. */
    onClose,
    bloc: injected
  }: {
    isOpen?: boolean;
    queryClient?: QueryCachePort;
    /** `avatar` is the square, circle-clipped picture; `banner` the 4:1 strip. */
    variant?: ProfileImageVariant;
    onClose?: () => void;
    bloc?: ProfileImageUploadBloc;
  } = $props();

  const ownBloc = new ProfileImageUploadBloc({
    get variant() {
      return variant;
    },
    get cache() {
      return queryClient;
    },
    get onClose() {
      return onClose;
    }
  });
  const bloc = $derived(injected ?? ownBloc);

  let fileInput = $state<HTMLInputElement | undefined>();
  let canvas = $state<HTMLCanvasElement | undefined>();

  /** Mouse and touch report a point differently; the bloc only wants the point. */
  function pointOf(event: MouseEvent | TouchEvent): { x: number; y: number } {
    return 'touches' in event
      ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
      : { x: event.clientX, y: event.clientY };
  }

  function handleCropKeydown(event: KeyboardEvent) {
    const step = event.shiftKey ? 20 : 4;
    if (event.key === 'ArrowLeft') bloc.nudge(-step, 0);
    else if (event.key === 'ArrowRight') bloc.nudge(step, 0);
    else if (event.key === 'ArrowUp') bloc.nudge(0, -step);
    else if (event.key === 'ArrowDown') bloc.nudge(0, step);
    else return;
    event.preventDefault();
  }
</script>

<svelte:window
  onmousemove={(event) => bloc.dragTo(pointOf(event))}
  onmouseup={() => bloc.endDrag()}
/>

<Modal {isOpen} onClose={() => bloc.close()} className="max-w-2xl max-h-[90vh]">
  <div class="cropper">
    <h3 class="cropper-title">{bloc.preset.title}</h3>

    <div class="cropper-body">
      {#if !bloc.previewUrl}
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <div
          class="dropzone {bloc.dragActive ? 'is-active' : ''}"
          ondrop={(event) => {
            event.preventDefault();
            bloc.acceptFile(event.dataTransfer?.files[0]);
          }}
          ondragover={(event) => {
            event.preventDefault();
            bloc.setDragActive(true);
          }}
          ondragleave={() => bloc.setDragActive(false)}
          onclick={() => fileInput?.click()}
          onkeydown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              fileInput?.click();
            }
          }}
          role="button"
          tabindex="0"
          aria-label={bloc.preset.title}
        >
          <svg class="dropzone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 15V3m0 0L8 7m4-4l4 4" />
            <path d="M20 15v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4" />
          </svg>
          <p class="dropzone-primary">{bloc.dragActive ? 'Drop to use this image' : 'Drop an image, or click to choose'}</p>
          <p class="dropzone-hint">
            PNG · JPG{#if bloc.variant === 'banner'} · WEBP{/if} &nbsp;·&nbsp; at least <span class="num">{bloc.preset.min.w}×{bloc.preset.min.h}</span>
          </p>
          <input
            bind:this={fileInput}
            type="file"
            class="hidden"
            accept="image/*"
            onchange={(event) => bloc.acceptFile((event.currentTarget as HTMLInputElement).files?.[0])}
          />
        </div>
      {:else}
        <div class="stage">
          <div class="frame-wrap" style="width: {bloc.imageSize.width}px; height: {bloc.imageSize.height}px; max-width: 100%;">
            <img src={bloc.previewUrl} alt="Preview" class="frame-img" style="width: {bloc.imageSize.width}px; height: {bloc.imageSize.height}px;" draggable="false" />
            <!-- The kept region: an accent frame is the one selection on screen,
                 the scrim outside darkens the rest so the kept picture is the
                 brightest thing -- the product's own rule, here too. -->
            <div
              class="crop {bloc.preset.circular ? 'crop--circle' : ''}"
              style="left: {bloc.crop.x}px; top: {bloc.crop.y}px; width: {bloc.crop.width}px; height: {bloc.cropHeight}px;"
              onmousedown={(event) => bloc.startDrag(pointOf(event))}
              ontouchstart={(event) => bloc.startDrag(pointOf(event))}
              ontouchmove={(event) => bloc.dragTo(pointOf(event))}
              ontouchend={() => bloc.endDrag()}
              onkeydown={handleCropKeydown}
              role="button"
              tabindex="0"
              aria-label="Drag or arrow-key to position the crop"
            >
              {#if !bloc.preset.circular}
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
              <span class="num readout-dims">{bloc.keptSize.width}<span class="readout-x">×</span>{bloc.keptSize.height}</span>
              <span class="num readout-zoom">{bloc.zoomFactor.toFixed(1)}×</span>
            </div>
            <div class="rail">
              <div class="rail-fill" style="width: {bloc.zoomPercent}%"></div>
              <input
                class="rail-input"
                type="range"
                min="0"
                max="100"
                step="1"
                value={bloc.zoomPercent}
                oninput={(event) => bloc.setZoom(Number((event.currentTarget as HTMLInputElement).value))}
                aria-label="Zoom"
              />
              <div class="rail-thumb" style="left: {bloc.zoomPercent}%"></div>
            </div>
            <p class="controls-hint">Drag the frame to reposition · slider or arrow keys to fine-tune</p>
          </div>
        </div>
      {/if}
    </div>

    <canvas bind:this={canvas} class="hidden"></canvas>

    {#if bloc.uploadError}
      <div class="cropper-error" role="alert">{bloc.uploadError}</div>
    {/if}

    <div class="cropper-footer">
      {#if bloc.previewUrl && !bloc.justSaved}
        <button type="button" class="link-btn" onclick={() => bloc.chooseNewImage(() => fileInput?.click())}>Choose different image</button>
      {:else}
        <span></span>
      {/if}
      <div class="footer-actions">
        {#if bloc.justSaved}
          <span class="saved">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10.5l3.2 3.2L15 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Saved
          </span>
        {:else}
          <Button color="transparent" label="Cancel" onClick={() => bloc.close()} showLabel={true} />
          {#if bloc.previewUrl}
            <Button
              color="blue"
              label={bloc.isUploading ? 'Uploading…' : 'Save'}
              onClick={() => bloc.save(canvas)}
              showLabel={true}
              status={bloc.saveStatus}
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
