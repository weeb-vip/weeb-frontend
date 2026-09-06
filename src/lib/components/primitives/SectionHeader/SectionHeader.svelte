<script lang="ts" module>
  /**
   * Three scales, because three are defensible: a shelf heading on the
   * homepage, a section heading inside the show page's column, and the eyebrow
   * over a group within a section. What was NOT defensible was three
   * implementations of them -- `SectionHeader`, `ShowSection.section-heading`
   * and `RelatedAnime.rel-group-heading` each wrote their own.
   */
  export type SectionHeaderSize = 'section' | 'sub' | 'eyebrow';
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    title,
    href = '',
    linkText = '',
    size = 'section',
    /** Which heading level this is in the page outline. */
    as = 'h2',
    /** The hairline that runs from the words to the edge of the column. */
    rule = false,
    /** Set it when something uses `aria-labelledby` to point at this heading. */
    id = undefined,
    children,
  }: {
    title: string;
    href?: string;
    linkText?: string;
    size?: SectionHeaderSize;
    as?: 'h2' | 'h3';
    rule?: boolean;
    id?: string | undefined;
    /** Optional trailing content, rendered after the title and link. */
    children?: Snippet;
  } = $props();
</script>

<div class="section-header section-header--{size}" class:has-rule={rule}>
  <svelte:element this={as} {id} class="heading">{title}</svelte:element>
  {#if rule}
    <span class="rule" aria-hidden="true"></span>
  {/if}
  {#if href && linkText}
    <a {href}>{linkText}</a>
  {/if}
  {@render children?.()}
</div>

<style>
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    margin-bottom: 20px;
  }
  .heading {
    font-family: var(--weeb-font);
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: var(--weeb-fg);
    margin: 0;
  }

  /* Inside the show page's column, where the page title is the hero above it. */
  .section-header--sub {
    margin-bottom: 16px;
  }
  .section-header--sub .heading {
    font-size: 18px;
  }

  /* Over a group inside a section -- a rank below the sections themselves, so
     it reads as a label rather than as a second heading level competing with
     the one above it. */
  .section-header--eyebrow {
    align-items: baseline;
    margin-bottom: 10px;
  }
  .section-header--eyebrow .heading {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--weeb-fg-muted);
  }

  /* The rule runs from the end of the words to the edge of the column, so the
     heading measures the section rather than floating above it. It takes the
     slack, which is why a ruled header does not also space-between. */
  .section-header.has-rule {
    justify-content: flex-start;
  }
  .rule {
    flex: 1;
    height: 1px;
    background: var(--weeb-border);
  }

  a {
    font-size: 12px;
    /* The accent as text is only 3.93:1 on this ground; accent-text is the
       lightness that clears AA without changing the accent used as a fill. */
    color: var(--weeb-accent-text);
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
    position: relative;
  }
  /* WCAG 2.5.5: the mark stays small, the target does not. */
  a::after {
    content: '';
    position: absolute;
    inset: -13px -10px;
  }
  a:hover {
    color: var(--weeb-accent-hover);
  }

  @media (max-width: 480px) {
    .section-header {
      margin-bottom: 14px;
    }
    /* Headline stays 20px on a phone. At 16 it sat only 4px above the card
       metadata, which is what made the page read as one flat band of text
       instead of a hierarchy. */
    .heading {
      font-size: 20px;
    }
    .section-header--sub .heading {
      font-size: 18px;
    }
    .section-header--eyebrow .heading {
      font-size: 12px;
    }
    a {
      font-size: 12px;
    }
  }
</style>
