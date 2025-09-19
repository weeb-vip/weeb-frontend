<script lang="ts">
  import { getContext } from 'svelte';

  export let username: string = '';
  export let profileImageUrl: string | null = null;
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let linkToProfile: boolean = true;
  export let className: string = '';

  let imageError = false;

  const config = getContext('config') || { cdn_user_url: '' };

  function getInitial(): string {
    if (!username) return '?';
    return username.charAt(0).toUpperCase();
  }

  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-16 h-16 text-xl'
  };

  function getImageUrl(): string | undefined {
    if (!profileImageUrl) return undefined;
    const suffix = size === 'lg' ? '_64' : '_32';
    // Insert suffix before file extension
    const lastDotIndex = profileImageUrl.lastIndexOf('.');
    if (lastDotIndex === -1) return `${config.cdn_user_url}/${profileImageUrl}${suffix}`;

    const nameWithoutExt = profileImageUrl.substring(0, lastDotIndex);
    const extension = profileImageUrl.substring(lastDotIndex);
    return `${config.cdn_user_url}/${nameWithoutExt}${suffix}${extension}`;
  }

  function handleImageError() {
    imageError = true;
  }

  $: avatarClasses = `${sizeClasses[size]} rounded-full flex items-center justify-center font-semibold cursor-pointer transition-all duration-300 hover:ring-2 hover:ring-blue-500 hover:ring-offset-2 dark:hover:ring-offset-gray-900 ${className}`;
</script>

{#if linkToProfile}
  <a href="/profile" class="block">
    <div class={avatarClasses}>
      {#if profileImageUrl && !imageError}
        <img
          src={getImageUrl()}
          alt={username}
          class="w-full h-full rounded-full object-cover"
          on:error={handleImageError}
        />
      {:else}
        <div class="w-full h-full rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white">
          {getInitial()}
        </div>
      {/if}
    </div>
  </a>
{:else}
  <div class={avatarClasses}>
    {#if profileImageUrl && !imageError}
      <img
        src={getImageUrl()}
        alt={username}
        class="w-full h-full rounded-full object-cover"
        on:error={handleImageError}
      />
    {:else}
      <div class="w-full h-full rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white">
        {getInitial()}
      </div>
    {/if}
  </div>
{/if}