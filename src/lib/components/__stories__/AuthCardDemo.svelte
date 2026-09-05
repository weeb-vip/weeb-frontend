<script lang="ts">
  import AuthCard from '$lib/components/auth/AuthCard.svelte';
  import Button from '$lib/components/primitives/Button.svelte';
  import FormInput from '$lib/components/primitives/FormInput.svelte';

  /**
   * The shell with the content its real call sites put in it.
   *
   * The stories used to hand AuthCard a raw-HTML form of bare `<input>`s, which
   * is exactly the fiction that hid the error-state bug: nothing on a real auth
   * screen is a bare input any more, they are all FormInput. Driving the story
   * through the real field and the real Button is what makes `error` below
   * actually prove the red border renders inside the card.
   */
  let {
    title = '',
    subtitle = '',
    showLogo = true,
    showBackground = true,
    withFooter = false,
    withMedia = false,
    body = 'form',
    error = false,
  }: {
    title?: string;
    subtitle?: string;
    showLogo?: boolean;
    showBackground?: boolean;
    withFooter?: boolean;
    withMedia?: boolean;
    /** `form` is Login/Register; `steps` is the CheckEmail body. */
    body?: 'form' | 'steps';
    error?: boolean;
  } = $props();
</script>

<AuthCard {title} {subtitle} {showLogo} {showBackground}>
  {#snippet media()}
    {#if withMedia}
      <div class="glyph" aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m5 13 4 4L19 7" />
        </svg>
      </div>
    {/if}
  {/snippet}

  {#snippet children()}
    {#if body === 'steps'}
      <ol class="steps">
        <li>1 &middot; Open the email from weeb.vip</li>
        <li>2 &middot; Click <em>Verify my email</em></li>
        <li>3 &middot; Come back here and log in</li>
      </ol>
    {:else}
      <form class="demo-form" onsubmit={(event) => event.preventDefault()} novalidate>
        <FormInput
          id="sb-auth-user"
          name="username"
          type="text"
          label="Username or email"
          placeholder="you@example.com"
          error={error ? 'Username is required' : ''}
        />
        <FormInput
          id="sb-auth-pass"
          name="password"
          type="password"
          label="Password"
          placeholder="Enter your password"
          showPasswordToggle
          error={error ? 'Password is required' : ''}
        />
        <Button type="submit" size="lg" fullWidth>Log in</Button>
      </form>
    {/if}
  {/snippet}

  {#snippet footer()}
    {#if withFooter}
      <span>Don't have an account? <a href="/auth/register">Sign up</a></span>
    {/if}
  {/snippet}
</AuthCard>

<style>
  .glyph {
    width: 56px;
    height: 56px;
    border-radius: var(--weeb-radius-full);
    background: color-mix(in oklch, var(--weeb-green) 15%, transparent);
    color: var(--weeb-green);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .demo-form {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .steps {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 0;
    margin: 0;
    list-style: none;
    color: var(--weeb-fg-secondary);
    font-size: 14px;
  }

  .steps em {
    color: var(--weeb-fg);
    font-style: normal;
  }
</style>
