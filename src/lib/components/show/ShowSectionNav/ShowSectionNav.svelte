<script lang="ts">
  import ChipGroup, { type ChipGroupItem } from '$lib/components/primitives/ChipGroup';
  import type { SectionTab } from '$lib/components/show/ShowContent.rules';

  /**
   * The bar pinned under the nav that says which part of the page you are in.
   *
   * `mode="toggle"` rather than `tabs`: these buttons scroll the page, they do
   * not swap panels, so a `tablist` would promise a keyboard user panels that
   * do not exist -- and it would change the buttons' role, which the news e2e
   * spec addresses by role. `underline` keeps the look the hand-rolled strip
   * had, minus the 400 characters of inline style each button carried.
   *
   * Presentational -- no bloc. Which section is active is the page's state.
   */
  let {
    sections,
    active,
    onSelect,
    top = 'var(--weeb-nav-height)',
    height = $bindable(0),
  }: {
    sections: SectionTab[];
    active: string;
    onSelect: (section: string) => void;
    /** CSS length for the sticky offset, measured by the page. */
    top?: string;
    /** Measured back out, so the page can publish the sticky stack's height. */
    height?: number;
  } = $props();

  const items = $derived(sections as ChipGroupItem[]);
</script>

<nav
  data-tab-bar
  class="tab-bar"
  aria-label="Section navigation"
  style="top: {top};"
  bind:clientHeight={height}
>
  <div class="tab-bar-inner">
    <ChipGroup {items} value={active} onSelect={onSelect} variant="underline" mode="toggle" />
  </div>
</nav>

<style>
  .tab-bar {
    position: sticky;
    z-index: 50;
    background: color-mix(in oklch, var(--weeb-bg) 95%, transparent);
    border-bottom: 1px solid var(--weeb-border);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    transition: top 0.3s ease;
  }

  .tab-bar-inner {
    width: 100%;
    padding: 0 var(--weeb-section-px);
    display: flex;
    align-items: center;
  }

  /* The tabs are nowrap and there can be four of them with count badges, which
     is wider than a small phone. Scroll them inside the bar rather than letting
     them widen the document -- an overflowing tab bar scrolls the whole page
     sideways. */
  .tab-bar-inner :global(.chipgroup--underline) {
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
    /* The strip draws the bar's rule; a second one inside it doubles up. */
    border-bottom: none;
  }
  .tab-bar-inner :global(.chipgroup--underline)::-webkit-scrollbar {
    display: none;
  }
  /* Carried past ChipGroup's own underline skin, which is one class heavier
     than a bare `:global(.cg-item)` would be. */
  .tab-bar-inner :global(.chipgroup--underline .chip.cg-item) {
    flex: none;
    padding: 10px 20px;
    font-size: 13px;
    border-bottom: 2px solid transparent;
  }
  .tab-bar-inner :global(.chipgroup--underline .chip.cg-item.selected) {
    color: var(--weeb-fg);
    border-bottom-color: var(--weeb-accent);
  }
</style>
