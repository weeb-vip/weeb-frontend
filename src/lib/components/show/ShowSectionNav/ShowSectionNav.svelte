<script lang="ts">
  import ChipGroup, { type ChipGroupItem } from '$lib/components/primitives/ChipGroup';
  import type { SectionTab } from '$lib/components/show/ShowContent.rules';

  /**
   * The bar pinned under the nav that says which part of the page you are in.
   *
   * `mode="toggle"` rather than `tabs`: these buttons scroll the page, they do
   * not swap panels, so a `tablist` would promise a keyboard user panels that
   * do not exist -- and it would change the buttons' role, which the news e2e
   * spec addresses by role. The chips are `ChipGroup`'s pills, the one row
   * treatment the app has left; the bar keeps only the two things that are its
   * own, a nowrap strip that scrolls rather than wrapping under the sticky
   * header, and the padding that sets its height.
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
    <ChipGroup {items} value={active} onSelect={onSelect} mode="toggle" />
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
    /* The pills bring their own 32px, so this padding IS the rest of the bar's
       height -- 44px in total, within a pixel or two of the height the
       underlined strip had. The page measures this bar to offset the sticky
       stack, so its height is not a free parameter. */
    padding: 6px var(--weeb-section-px);
    display: flex;
    align-items: center;
  }

  /* There can be four pills with count badges, which is wider than a small
     phone. Scroll them inside the bar rather than letting them wrap it onto a
     second line -- this bar is sticky, and a bar that changes height under the
     header shoves the page around. `nowrap` is the one thing this row does not
     take from the pill skin. */
  .tab-bar-inner :global(.chipgroup--pill) {
    min-width: 0;
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .tab-bar-inner :global(.chipgroup--pill)::-webkit-scrollbar {
    display: none;
  }
</style>
