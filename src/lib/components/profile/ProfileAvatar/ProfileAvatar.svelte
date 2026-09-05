<script lang="ts">
  import { getContext } from 'svelte';
  import { configStore } from '$lib/stores/config';
  import {
    avatarClasses,
    avatarImageUrl,
    DEFAULT_CDN_USER_URL,
    initialFor,
    type ProfileAvatarSize
  } from './ProfileAvatar.logic';

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
    size?: ProfileAvatarSize;
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
  const cdnUserUrl: string = config?.cdn_user_url || DEFAULT_CDN_USER_URL;

  const initial = $derived(initialFor(initials, username));
  const imageUrl = $derived(avatarImageUrl(src, profileImageUrl, size, cdnUserUrl));
  const hasImage = $derived(!!imageUrl && !imageError);
  const classes = $derived(avatarClasses(size, className));
</script>

<!-- One copy of the circle, rendered either inside the profile link or bare.
     The two branches had drifted into duplicated markup for the same face. -->
{#snippet face()}
  <div class={classes} class:avatar-hero={size === 'xl'}>
    {#if hasImage}
      <img
        src={imageUrl}
        alt={alt ?? username}
        class="w-full h-full rounded-full object-cover"
        onerror={() => (imageError = true)}
      />
    {:else if size === 'xl'}
      <span class="avatar-initials">{initial}</span>
    {:else}
      <!-- The same ground at every size. The small ones used to be a Tailwind
           from-blue-500 to-purple-600, so the nav avatar stayed blue while the
           hero one was the accent -- and a viewer on the green or rose accent
           had a blue initial in the header of their own page. -->
      <div class="avatar-fallback">
        <span class="avatar-initials">{initial}</span>
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
  /* The ground the initials sit on, and what shows through while a picture
     loads. One gradient, off the accent, shared by every size. */
  .avatar-hero,
  .avatar-fallback {
    background: linear-gradient(
      135deg,
      var(--weeb-accent) 0%,
      var(--weeb-accent-hover) 50%,
      color-mix(in oklch, var(--weeb-accent-hover) 60%, var(--weeb-accent)) 100%
    );
  }

  /* The hero face. Sized by its wrapper, so the page owns the dimensions and
     their breakpoints. */
  .avatar-hero {
    border-radius: var(--weeb-radius-full);
    border: 4px solid var(--weeb-bg);
    box-shadow: 0 8px 32px color-mix(in oklch, var(--weeb-bg) 50%, transparent);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .avatar-fallback {
    width: 100%;
    height: 100%;
    border-radius: var(--weeb-radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Inherits the size class's own font-size at sm/md/lg; the hero sets its own
     because its circle is sized by the page rather than by a class here. */
  .avatar-initials {
    font-weight: 700;
    line-height: 1;
    color: #fff;
    letter-spacing: 0.02em;
  }
  .avatar-hero > .avatar-initials {
    font-size: var(--hero-avatar-initials, 2.5rem);
  }
</style>
