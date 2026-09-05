<script lang="ts">
  import { getContext } from 'svelte';
  import { configStore } from '../stores/config';

  /**
   * Presentational -- no bloc. It takes a username and an image name and draws
   * a circle; the CDN base it needs is read once at init rather than owned.
   */
  let {
    username = '',
    profileImageUrl = null,
    size = 'md',
    linkToProfile = true,
    className = ''
  }: {
    username?: string;
    profileImageUrl?: string | null;
    size?: 'sm' | 'md' | 'lg';
    linkToProfile?: boolean;
    className?: string;
  } = $props();

  let imageError = $state(false);

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

  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-16 h-16 text-xl'
  };

  const initial = $derived(username ? username.charAt(0).toUpperCase() : '?');

  const imageUrl = $derived.by(() => {
    if (!profileImageUrl) return undefined;
    const suffix = size === 'lg' ? '_64' : '_32';
    // Insert suffix before file extension
    const lastDotIndex = profileImageUrl.lastIndexOf('.');
    if (lastDotIndex === -1) return `${cdnUserUrl}/${profileImageUrl}${suffix}`;

    const nameWithoutExt = profileImageUrl.substring(0, lastDotIndex);
    const extension = profileImageUrl.substring(lastDotIndex);
    return `${cdnUserUrl}/${nameWithoutExt}${suffix}${extension}`;
  });

  const avatarClasses = $derived(
    `${sizeClasses[size]} rounded-full flex items-center justify-center font-semibold cursor-pointer transition-all duration-300 hover:ring-2 hover:ring-weeb-accent hover:ring-offset-2 ${className}`
  );
</script>

<!-- One copy of the circle, rendered either inside the profile link or bare.
     The two branches had drifted into duplicated markup for the same face. -->
{#snippet face()}
  <div class={avatarClasses}>
    {#if profileImageUrl && !imageError}
      <img
        src={imageUrl}
        alt={username}
        class="w-full h-full rounded-full object-cover"
        onerror={() => (imageError = true)}
      />
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
