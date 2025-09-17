<script lang="ts">
  let count = 0;

  function increment() {
    count++;
  }

  function decrement() {
    count--;
  }

  function reset() {
    count = 0;
  }
</script>

<div class="bg-gray-800 rounded-lg p-6 max-w-sm mx-auto">
  <h2 class="text-xl font-semibold text-white mb-4">Svelte Counter Component</h2>

  <div class="text-center">
    <div class="text-3xl font-bold text-blue-400 mb-4">
      {count}
    </div>

    <div class="flex gap-2 justify-center">
      <button
        on:click={decrement}
        class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
      >
        -
      </button>

      <button
        on:click={reset}
        class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
      >
        Reset
      </button>

      <button
        on:click={increment}
        class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
      >
        +
      </button>
    </div>
  </div>

  <p class="text-gray-400 text-sm mt-4 text-center">
    This is a Svelte component running alongside React!
  </p>
</div>

<style>
  /* Component-specific styles can go here if needed */
  /* TailwindCSS classes are already available */
</style>