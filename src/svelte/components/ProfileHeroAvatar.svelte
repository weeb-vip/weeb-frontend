<script lang="ts">
  /**
   * The large avatar at the top of a profile: the picture, or the initials
   * behind it when there is none -- or when the one on file fails to load.
   *
   * ProfilePage and PublicUserPage both drew this, and both had their own copy
   * of the fallback rule. It is not ProfileAvatar: that one is the 32-48px nav
   * face, and it asks the CDN for a `_32`/`_64` thumbnail, which is visibly soft
   * blown up to this size. This renders the full-quality original.
   *
   * Presentational -- no bloc. It sizes itself to its wrapper, so the page owns
   * the dimensions and their breakpoints.
   */
  let {
    src = null,
    alt = '',
    initials = '?',
    size = null,
    class: className = '',
  }: {
    /** A ready-built URL, or null for the initials. */
    src?: string | null;
    alt?: string;
    initials?: string;
    /** A CSS length, when there is no sized wrapper to fill -- stories, mostly. */
    size?: string | null;
    class?: string;
  } = $props();

  /**
   * A stale or missing image left a broken <img> in place: the URL is truthy,
   * so the initials branch never ran and the avatar rendered as nothing at all.
   */
  let failed = $state(false);

  // A new picture deserves a fresh attempt at loading it.
  $effect(() => {
    src;
    failed = false;
  });
</script>

<div class="hero-avatar {className}" style={size ? `width:${size};height:${size};` : ''}>
  {#if src && !failed}
    <img class="hero-avatar-img" {src} {alt} onerror={() => (failed = true)} />
  {:else}
    <span class="hero-avatar-initials">{initials}</span>
  {/if}
</div>

<style>
  .hero-avatar {
    width: 100%;
    height: 100%;
    border-radius: var(--weeb-radius-full, 9999px);
    border: 4px solid var(--weeb-bg);
    /* The gradient is the ground the initials sit on, and what shows through
       while a picture loads. */
    background: linear-gradient(
      135deg,
      var(--weeb-accent) 0%,
      var(--weeb-violet, var(--weeb-accent-hover)) 50%,
      color-mix(in oklch, var(--weeb-violet, var(--weeb-accent-hover)) 60%, var(--weeb-accent)) 100%
    );
    box-shadow: 0 8px 32px color-mix(in oklch, black 50%, transparent);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .hero-avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .hero-avatar-initials {
    font-size: var(--hero-avatar-initials, 2.5rem);
    font-weight: 700;
    line-height: 1;
    color: #fff;
    letter-spacing: 0.02em;
  }
</style>
