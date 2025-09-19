<script lang="ts">
  import Skeleton from './Skeleton.svelte';
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-md w-full space-y-8">
    <!-- Header section -->
    <div class="text-center">
      <!-- Logo skeleton -->
      <div class="flex justify-center mb-6">
        <Skeleton className="h-12 w-32" />
      </div>

      <!-- Title skeleton -->
      <Skeleton className="h-8 w-64 mx-auto mb-2" />

      <!-- Description skeleton -->
      <Skeleton className="h-4 w-72 mx-auto" />
    </div>

    <!-- Form section -->
    <div class="mt-8 space-y-6">
      <div class="space-y-4">
        <!-- Email field -->
        <div>
          <Skeleton className="h-4 w-24 mb-2" />
          <div class="relative">
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>

      <!-- Submit button -->
      <div>
        <Skeleton className="h-10 w-full" />
      </div>

      <!-- Links section -->
      <div class="text-center space-y-2">
        <Skeleton className="h-4 w-40 mx-auto" />
        <Skeleton className="h-4 w-32 mx-auto" />
        <Skeleton className="h-4 w-24 mx-auto" />
      </div>
    </div>
  </div>
</div>