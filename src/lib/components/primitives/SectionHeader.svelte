<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    title,
    href = '',
    linkText = '',
    children,
  }: {
    title: string;
    href?: string;
    linkText?: string;
    /** Optional trailing content, rendered after the title and link. */
    children?: Snippet;
  } = $props();
</script>

<div class="section-header">
  <h2>{title}</h2>
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
    margin-bottom: 20px;
  }
  h2 {
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.01em;
    margin: 0;
  }
  a {
    font-size: 12px;
    /* The accent as text is only 3.93:1 on this ground; accent-text is the
       lightness that clears AA without changing the accent used as a fill. */
    color: var(--weeb-accent-text);
    font-weight: 600;
    text-decoration: none;
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
    h2 {
      font-size: 20px;
    }
    a {
      font-size: 12px;
    }
  }
</style>
