<script lang="ts">
  import { getContext } from 'svelte';
  import { configStore } from '../stores/config';

  /**
   * The user's face, at every size the app draws it: the 32-40px nav thumbnail,
   * the 64px disc, and the 108-120px circle at the top of a profile.
   *
   * The large one used to be a second component (ProfileHeroAvatar) purely
   * because this one capped at `lg` and asked the CDN for a thumbnail that is
   * visibly soft blown up to hero size. That is a `size` variant, not a
   * different component, so it is one now -- and the fallback rule, which had
   * drifted into two copies, is written once here.
   *
   * Presentational -- no bloc. It takes a username and an image and draws a
   * circle; the CDN base it needs is read once at init rather than owned.
   */
  let {
    username = '',
    profileImageUrl = null,
    src = null,
    alt = null,
    initials = null,
    size = 'md',
    linkToProfile = true,
    className = ''
  }: {
    username?: string;
    /** A stored file name, resolved against the CDN at the size below. */
    profileImageUrl?: string | null;
    /** A ready-built URL, used verbatim -- what the profile blocs hand over. */
    src?: string | null;
    /** Defaults to the username. */
    alt?: string | null;
    /** Defaults to the username's first letter; the public page passes two. */
    initials?: string | null;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    linkToProfile?: boolean;
    className?: string;
  } = $props();

  /**
   * A stale or missing image left a broken <img> in place: the URL is truthy,
   * so the initials branch never ran and the avatar rendered as nothing at all.
   * Reset on a new source, so a fresh upload gets a fresh attempt.
   */
  let imageError = $state(false);
  $effect(() => {
    src;
    profileImageUrl;
    imageError = false;
  });

  // Context first, then the store ConfigProvider itself reads from.
  //
  // The store fallback is what makes this component work outside a
  // ConfigProvider. Only the desktop header wraps one, so every other consumer
  // -- the mobile drawer among them -- got cdn_user_url: '' and built a
  // relative URL that 404s. The <img> error handler then swapped in the
  // initial, so the avatar looked deliberate rather than broken.
  const config = getContext<{ cdn_user_url: string } | undefined>('config') ??
    (configStore.get() as { cdn_user_url?: string } | undefined) ??
    undefined;
  const cdnUserUrl: string = config?.cdn_user_url || 'https://cdn.weeb.vip/users';

  // `xl` has no fixed size: the profile hero sizes its own wrapper (120px on
  // desktop, 108px on the public page, 88/72px down the breakpoints) and the
  // circle fills it.
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-16 h-16 text-xl',
    xl: 'w-full h-full'
  };

  /**
   * The CDN thumbnail to ask for: the smallest variant that is not smaller
   * than the box it is drawn in. `md` used to take `_32` into a 40px circle,
   * so the nav avatar was upscaled even at 1x.
   *
   * `xl` takes no suffix at all -- the original. A `_64` in a 120px circle is
   * what made a second component look necessary.
   */
  const cdnSuffix = { sm: '_32', md: '_64', lg: '_64', xl: '' };

  const initial = $derived(initials || (username ? username.charAt(0).toUpperCase() : '?'));

  const imageUrl = $derived.by(() => {
    // A ready-built URL wins: the profile blocs already resolved it against
    // their own CDN base, and re-deriving it here would be a second answer.
    if (src) return src;
    if (!profileImageUrl) return undefined;

    const suffix = cdnSuffix[size];
    // Insert suffix before file extension
    const lastDotIndex = profileImageUrl.lastIndexOf('.');
    if (lastDotIndex === -1) return `${cdnUserUrl}/${profileImageUrl}${suffix}`;

    const nameWithoutExt = profileImageUrl.substring(0, lastDotIndex);
    const extension = profileImageUrl.substring(lastDotIndex);
    return `${cdnUserUrl}/${nameWithoutExt}${suffix}${extension}`;
  });

  const hasImage = $derived(!!imageUrl && !imageError);

  const avatarClasses = $derived(
    size === 'xl'
      ? `${sizeClasses.xl} ${className}`
      : `${sizeClasses[size]} rounded-full flex items-center justify-center font-semibold cursor-pointer transition-all duration-300 hover:ring-2 hover:ring-weeb-accent hover:ring-offset-2 ${className}`
  );
</script>

<!-- One copy of the circle, rendered either inside the profile link or bare.
     The two branches had drifted into duplicated markup for the same face. -->
{#snippet face()}
  <div class={avatarClasses} class:avatar-hero={size === 'xl'}>
    {#if hasImage}
      <img
        src={imageUrl}
        alt={alt ?? username}
        class="w-full h-full rounded-full object-cover"
        onerror={() => (imageError = true)}
      />
    {:else if size === 'xl'}
      <span class="avatar-hero-initials">{initial}</span>
    {:else}
      <div class="w-full h-full rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white">
        {initial}
      </div>
    {/if}
  </div>
{/snippet}

{#if linkToProfile}
  <a href="/profile" class="block">
    {@render face()}
  </a>
{:else}
  {@render face()}
{/if}

<style>
  /* The hero face. Sized by its wrapper, so the page owns the dimensions and
     their breakpoints. */
  .avatar-hero {
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

  .avatar-hero-initials {
    font-size: var(--hero-avatar-initials, 2.5rem);
    font-weight: 700;
    line-height: 1;
    color: #fff;
    letter-spacing: 0.02em;
  }
</style>
