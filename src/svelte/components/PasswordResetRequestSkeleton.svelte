<script lang="ts">
  import Skeleton from './Skeleton.svelte';
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-md w-full space-y-8">
    <!-- Header section -->
    <div class="text-center">
      <!-- Icon skeleton -->
      <div class="mx-auto h-12 w-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
        <Skeleton className="h-6 w-6" />
      </div>

      <!-- Title skeleton -->
      <Skeleton className="h-8 w-48 mx-auto mb-2" />

      <!-- Description skeleton -->
      <Skeleton className="h-4 w-72 mx-auto" />
    </div>

    <!-- Form section -->
    <div class="mt-8 space-y-6">
      <div class="space-y-4">
        <!-- Username field -->
        <div>
          <Skeleton className="h-4 w-20 mb-2" />
          <div class="relative">
            <Skeleton className="h-12 w-full" />
          </div>
        </div>

        <!-- Email field -->
        <div>
          <Skeleton className="h-4 w-16 mb-2" />
          <div class="relative">
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>

      <!-- Submit button -->
      <div class="mt-4">
        <Skeleton className="h-10 w-full" />
      </div>

      <!-- Back to home link -->
      <div class="text-center mt-2">
        <Skeleton className="h-4 w-24 mx-auto" />
      </div>
    </div>
  </div>
</div>