<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { createMutation } from '@tanstack/svelte-query';
  import { toast } from 'svelte-sonner';
  import { getQueryClient } from '../services/query-client';
  import { upsertWork } from '../../services/queries';
  import { WorkStatus } from '../../gql/graphql';

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

  export let workId: string;
  /** The work's chapter total, or null when the source never recorded one. */
  export let totalChapters: number | null = null;
  /** The viewer's row, present only when the work is tracked. */
  export let userWork: {
    status?: string | null;
    score?: number | null;
    chapters?: number | null;
    volumes?: number | null;
  } | null = null;

  const queryClient = getQueryClient();

  // Local, so the stepper answers immediately rather than after a round trip.
  let read: number = userWork?.chapters ?? 0;

  // Follow the server only when it actually changes, so a re-read of the prop
  // after our own successful write does not stamp on what the reader just set --
  // the same reason WorkStatusControl tracks its previous server value.
  let serverRead: number = userWork?.chapters ?? 0;
  $: {
    const incoming = userWork?.chapters ?? 0;
    if (incoming !== serverRead) {
      serverRead = incoming;
      read = incoming;
    }
  }

  $: max = totalChapters && totalChapters > 0 ? totalChapters : null;
  $: pct = max ? Math.min(100, Math.round((read / max) * 100)) : 0;
  $: atStart = read <= 0;
  $: atEnd = max != null && read >= max;

  const save = createMutation({
    mutationFn: async (next: number) =>
      upsertWork().mutationFn({
        input: {
          workID: workId,
          // Carry the rest of the row, or a chapters-only write would blank the
          // status and score the reader already set.
          status: (userWork?.status ?? undefined) as WorkStatus | undefined,
          score: userWork?.score ?? undefined,
          volumes: userWork?.volumes ?? undefined,
          chapters: next,
        },
      }),
    onSuccess: async () => {
      queryClient.invalidateQueries();
      await invalidateAll();
    },
    onError: (error: any) => {
      read = serverRead; // put it back to what the server still believes
      toast.error(String(error?.message ?? 'Could not save your progress'));
    },
  });

  function commit(next: number) {
    let value = Math.max(0, Math.round(next));
    if (max != null) value = Math.min(value, max);
    if (value === read) return;
    read = value;
    $save.mutate(value);
  }

  function onInput(event: Event) {
    const raw = parseInt((event.target as HTMLInputElement).value, 10);
    commit(Number.isNaN(raw) ? 0 : raw);
  }
</script>

<div class="chapter-progress">
  <div class="cp-head">
    <span class="cp-label">Chapters read</span>
    <span class="cp-count">
      <span class="num">{read}</span>{#if max}<span class="cp-sep">/</span><span class="num cp-total">{max}</span>{/if}
    </span>
  </div>

  <div class="cp-controls">
    <button
      type="button"
      class="cp-step"
      aria-label="One chapter fewer"
      disabled={atStart || $save.isPending}
      on:click={() => commit(read - 1)}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10h10" /></svg>
    </button>

    <input
      class="cp-input num"
      type="number"
      inputmode="numeric"
      min="0"
      max={max ?? undefined}
      aria-label="Chapters read"
      value={read}
      disabled={$save.isPending}
      on:change={onInput}
    />

    <button
      type="button"
      class="cp-step"
      aria-label="One chapter more"
      disabled={atEnd || $save.isPending}
      on:click={() => commit(read + 1)}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 5v10M5 10h10" /></svg>
    </button>
  </div>

  {#if max}
    <div class="cp-bar" role="progressbar" aria-valuenow={read} aria-valuemin={0} aria-valuemax={max}>
      <div class="cp-fill" style="--p: {pct / 100}"></div>
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
