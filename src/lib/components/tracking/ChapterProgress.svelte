<script lang="ts">
  import { ChapterProgressBloc } from './ChapterProgress.bloc.svelte';

  /**
   * How far through a work the reader is, in chapters.
   *
   * Deliberately a count rather than a tick per chapter, because that is all the
   * data there is: a work carries a chapter total, not a list of chapters the
   * way an anime carries its episodes. So this sets "read up to N" against that
   * total instead of enumerating something that was never scraped -- and writes
   * it straight to user_work.chapters, the same number the reading list shows.
   *
   * Shown only once the work is on the shelf. Tracking progress through
   * something you have not added is a state with nowhere to keep it.
   */

  let {
    workId,
    /** The work's chapter total, or null when the source never recorded one. */
    totalChapters = null,
    /** The viewer's row, present only when the work is tracked. */
    userWork = null,
    /**
     * Defaults to a bloc reading this component's props, so the call site is
     * unchanged. Stories and tests inject one with stub ports.
     */
    bloc = new ChapterProgressBloc({ work: () => ({ workId, totalChapters, userWork }) }),
  }: {
    workId: string;
    totalChapters?: number | null;
    userWork?: {
      status?: string | null;
      score?: number | null;
      chapters?: number | null;
      volumes?: number | null;
    } | null;
    bloc?: ChapterProgressBloc;
  } = $props();
</script>

<div class="chapter-progress">
  <div class="cp-head">
    <span class="cp-label">Chapters read</span>
    <span class="cp-count">
      <span class="num">{bloc.read}</span>{#if bloc.max}<span class="cp-sep">/</span><span class="num cp-total">{bloc.max}</span>{/if}
    </span>
  </div>

  <div class="cp-controls">
    <button
      type="button"
      class="cp-step"
      aria-label="One chapter fewer"
      disabled={bloc.atStart || bloc.busy}
      onclick={() => bloc.step(-1)}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10h10" /></svg>
    </button>

    <input
      class="cp-input num"
      type="number"
      inputmode="numeric"
      min="0"
      max={bloc.max ?? undefined}
      aria-label="Chapters read"
      value={bloc.read}
      disabled={bloc.busy}
      onchange={(event) => bloc.setReadFromText(event.currentTarget.value)}
    />

    <button
      type="button"
      class="cp-step"
      aria-label="One chapter more"
      disabled={bloc.atEnd || bloc.busy}
      onclick={() => bloc.step(1)}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 5v10M5 10h10" /></svg>
    </button>
  </div>

  {#if bloc.max}
    <div class="cp-bar" role="progressbar" aria-valuenow={bloc.read} aria-valuemin={0} aria-valuemax={bloc.max}>
      <div class="cp-fill" style="--p: {bloc.percent / 100}"></div>
    </div>
  {/if}
</div>

<style>
  .chapter-progress {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 15rem;
  }

  .cp-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }

  .cp-label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--weeb-fg-secondary);
  }

  /* Every figure in mono, per the numeral rule. */
  .cp-count {
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
  }
  .num {
    font-family: var(--weeb-font-mono, monospace);
    font-variant-numeric: tabular-nums;
  }
  .cp-count .num {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--weeb-fg);
  }
  .cp-sep,
  .cp-total {
    color: var(--weeb-fg-muted);
  }

  .cp-controls {
    display: flex;
    align-items: stretch;
    gap: 6px;
  }

  .cp-step {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    flex-shrink: 0;
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius, 8px);
    background: var(--weeb-surface);
    color: var(--weeb-fg);
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }
  .cp-step svg {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
  }
  .cp-step:hover:not(:disabled) {
    background: var(--weeb-surface-hover);
    border-color: var(--weeb-accent);
    color: var(--weeb-accent-text);
  }
  .cp-step:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .cp-input {
    flex: 1;
    min-width: 0;
    height: 34px;
    padding: 0 10px;
    text-align: center;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--weeb-fg);
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius, 8px);
    outline: none;
    transition: border-color 0.15s;
  }
  .cp-input:focus {
    border-color: var(--weeb-accent);
  }
  /* The spinners fight the custom steppers; drop them. */
  .cp-input::-webkit-outer-spin-button,
  .cp-input::-webkit-inner-spin-button {
    appearance: none;
    margin: 0;
  }
  .cp-input {
    -moz-appearance: textfield;
    appearance: textfield;
  }

  .cp-bar {
    height: 4px;
    border-radius: 999px;
    background: var(--weeb-surface-hover);
    overflow: hidden;
  }
  .cp-fill {
    height: 100%;
    width: 100%;
    border-radius: inherit;
    background: var(--weeb-accent);
    transform-origin: left center;
    transform: scaleX(var(--p, 0));
    transition: transform 0.2s ease;
  }
</style>
