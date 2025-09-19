<script lang="ts">
  import Skeleton from './Skeleton.svelte';
</script>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
  <div class="sm:mx-auto sm:w-full sm:max-w-md">
    <!-- Logo skeleton -->
    <div class="flex justify-center mb-6">
      <Skeleton className="h-12 w-32" />
    </div>

    <!-- Title skeleton -->
    <Skeleton className="h-8 w-48 mx-auto mb-2" />

    <!-- Description skeleton -->
    <Skeleton className="h-4 w-56 mx-auto" />
  </div>

  <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
    <div class="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
      <!-- Content area skeleton -->
      <div class="text-center">
        <!-- Loading spinner skeleton -->
        <Skeleton className="h-8 w-8 rounded-full mx-auto mb-4" />

        <!-- Message skeleton -->
        <Skeleton className="h-4 w-48 mx-auto" />
      </div>
    </div>
  </div>
</div>