<div class="relative w-full h-[600px] sm:h-[650px] md:h-[700px] animate-pulse overflow-hidden md:rounded-lg xs:rounded-none md:shadow-xl">
  <!-- Background skeleton -->
  <div class="absolute inset-0 overflow-hidden bg-gray-300 dark:bg-gray-700 rounded-lg sm:rounded-lg xs:rounded-none md:shadow-xl">
    <!-- Shimmer effect -->
    <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 dark:via-gray-600/20 to-transparent animate-shimmer"></div>
  </div>

  <!-- overlays -->
  <div class="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent"></div>
  <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>

  <!-- Foreground content skeleton -->
  <div class="relative z-10 h-full flex items-end px-4 sm:px-8 lg:px-16">
    <div class="max-w-3xl text-white py-12">
      <!-- Status badge skeleton -->
      <div class="inline-flex items-center px-4 py-3 rounded-full bg-red-600 text-sm font-semibold mb-4 animate-pulse">
        <div class="w-2 h-2 bg-white rounded-full mr-2"></div>
        <div class="w-24 h-4 bg-white/60 rounded"></div>
        <div class="ml-2 px-2 py-1 bg-black/25 rounded w-12 h-4 bg-white/40"></div>
      </div>

      <!-- Title skeleton -->
      <div class="mb-4 sm:mb-6">
        <div class="w-80 h-9 sm:h-11 lg:h-14 bg-gray-600 rounded animate-pulse"></div>
      </div>

      <!-- Episode info skeleton -->
      <div class="mb-6 sm:mb-8 space-y-3 sm:space-y-4">
        <!-- Episode title -->
        <div class="w-44 h-5 sm:h-6 lg:h-7 bg-gray-600 rounded animate-pulse"></div>

        <!-- Air date and JST badge -->
        <div class="flex flex-col sm:flex-row sm:items-center gap-2">
          <div class="w-64 h-4 sm:h-5 bg-gray-600 rounded animate-pulse"></div>
          <div class="px-2 py-1 bg-blue-600/20 rounded w-20 h-5 bg-blue-600/30 animate-pulse"></div>
        </div>
      </div>

      <!-- Buttons skeleton -->
      <div class="flex flex-wrap gap-4 items-center">
        <!-- More Info button -->
        <div class="w-24 h-10 bg-blue-600/50 rounded animate-pulse"></div>

        <!-- Add to List button -->
        <div class="w-28 h-10 bg-gray-600/50 rounded animate-pulse"></div>
      </div>
    </div>
  </div>
</div>

<style>
  @keyframes shimmer {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }

  .animate-shimmer {
    animation: shimmer 2s infinite;
  }
</style>
