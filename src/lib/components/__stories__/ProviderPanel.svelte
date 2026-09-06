<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { PanelRow } from './provider-stubs';

  /**
   * The readout every provider story renders.
   *
   * The five App Shell providers put things in context, in a store or on a
   * schedule and draw nothing at all, so the story's whole job is to show what
   * a child of one of them actually receives. This is the one card that does
   * it -- a title, a sentence of what is being shown, and the values, so five
   * stories report in the same shape rather than five slightly different ones.
   */
  let {
    title,
    note = '',
    rows = [],
    children,
  }: {
    title: string;
    /** One line: what a child of this provider is getting, in words. */
    note?: string;
    rows?: PanelRow[];
    children?: Snippet;
  } = $props();
</script>

<section class="panel">
  <h2>{title}</h2>
  {#if note}<p class="note">{note}</p>{/if}

  {#if rows.length}
    <dl>
      {#each rows as row (row.label)}
        <div class="row">
          <dt>{row.label}</dt>
          <dd class={row.tone ?? 'plain'}>{row.value}</dd>
        </div>
      {/each}
    </dl>
  {/if}

  {@render children?.()}
</section>

<style>
  .panel {
    max-width: 640px;
    padding: 20px 22px;
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius);
    background: var(--weeb-surface);
    color: var(--weeb-fg);
    font-family: var(--weeb-font);
  }

  h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.01em;
  }

  .note {
    margin: 6px 0 0;
    font-size: 13px;
    line-height: 1.5;
    color: var(--weeb-fg-secondary);
  }

  dl {
    margin: 16px 0 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
    background: var(--weeb-border);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius-sm);
    overflow: hidden;
  }

  .row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
    gap: 12px;
    padding: 8px 12px;
    background: var(--weeb-bg-elevated);
  }

  dt {
    margin: 0;
    font-size: 12px;
    color: var(--weeb-fg-muted);
  }

  dd {
    margin: 0;
    font-family: var(--weeb-font-mono);
    font-size: 12px;
    word-break: break-word;
  }

  dd.ok {
    color: var(--weeb-green);
  }
  dd.warn {
    color: var(--weeb-amber);
  }
  dd.bad {
    color: var(--weeb-red);
  }
</style>
