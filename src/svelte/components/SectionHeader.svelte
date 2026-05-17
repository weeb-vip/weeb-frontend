<script lang="ts">
  export let title: string;
  export let href: string = '';
  export let linkText: string = '';
</script>

<div class="section-header">
  <h2>{title}</h2>
  {#if href && linkText}
    <a {href}>{linkText}</a>
  {/if}
  <slot />
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
    font-size: 13px;
    color: var(--weeb-accent);
    font-weight: 500;
    text-decoration: none;
  }
  a:hover {
    color: var(--weeb-accent-hover);
  }

  @media (max-width: 480px) {
    .section-header {
      margin-bottom: 14px;
    }
    h2 {
      font-size: 16px;
    }
    a {
      font-size: 12px;
    }
  }
</style>
