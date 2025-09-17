<script lang="ts">
  export let style: 'default' | 'hover-transparent' | 'hover' | 'transparent' | 'long' | 'detail' | 'episode' = 'default';
  export let forceListLayout: boolean = false;

  function getSkeletonLayout(style: string, forceListLayout: boolean) {
    const bg = style === 'transparent' ? 'bg-transparent' : 'bg-white dark:bg-gray-800';

    const base =
      `flex ${forceListLayout ? 'flex-row' : 'sm:flex-row md:flex-col'} ` +
      `${bg} rounded-md shadow-sm w-full transition-colors duration-300 ` +
      `overflow-hidden animate-pulse`;

    switch (style) {
      case 'long':
        return {
          container: `${base} w-96 h-40`,
          image: `${forceListLayout ? 'w-40 sm:w-48' : 'w-64 sm:w-72 md:w-80'} aspect-2/3`,
          lines: 5,
          isEpisode: false,
        };
      case 'detail':
        return {
          container: `${base} min-h-[180px]`,
          image: `${forceListLayout ? 'w-32 sm:w-40' : 'w-40 sm:w-48 md:w-56'} aspect-2/3`,
          lines: 4,
          isEpisode: false,
        };
      case 'episode':
        return {
          container: `${base} ${forceListLayout ? 'h-40' : 'h-44'}`,
          image: `${forceListLayout ? 'w-24 sm:w-28 md:w-32' : 'w-32 sm:w-40 md:w-44'} aspect-2/3`,
          lines: 4,
          isEpisode: true,
        };
      case 'hover':
      case 'hover-transparent':
      case 'default':
      default:
        return {
          container: `${base} w-48 h-72`,
          image: `${forceListLayout ? 'w-28 md:w-32' : 'w-32 sm:w-40 md:w-48'} aspect-2/3`,
          lines: 3,
          isEpisode: false,
        };
    }
  }

  $: layout = getSkeletonLayout(style, forceListLayout);
</script>

<div class={layout.container}>
  <div class="{layout.image} bg-gray-200 dark:bg-gray-700" />
  <div class="flex flex-col justify-between px-4 py-3 w-full h-full">
    <div class="space-y-2">
      <!-- Title line -->
      <div class="w-full h-4 bg-gray-200 dark:bg-gray-700 rounded" />

      {#if layout.isEpisode}
        <div class="w-2/3 h-3 bg-gray-200 dark:bg-gray-700 rounded" />
        <div class="w-1/2 h-3 bg-gray-200 dark:bg-gray-700 rounded" />
        <div class="w-2/3 h-3 bg-gray-200 dark:bg-gray-700 rounded" />
      {:else}
        {#each Array(layout.lines - 1) as _, i}
          <div
            class="h-3 bg-gray-200 dark:bg-gray-700 rounded {i === 0 ? 'w-2/3' : i === 1 ? 'w-1/3' : 'w-1/4'}"
          />
        {/each}
      {/if}
    </div>

    <!-- Button / options stub -->
    <div class="pt-3">
      <div
        class="h-8 rounded-full {style === 'transparent'
          ? 'bg-gray-300/60 dark:bg-gray-600/60'
          : 'bg-gray-300 dark:bg-gray-600'} {forceListLayout ? 'mx-0 w-24' : 'mx-auto w-24'}"
      />
    </div>
  </div>
</div>