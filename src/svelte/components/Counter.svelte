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

<div class="bg-weeb-bg-elevated rounded-lg p-6 max-w-sm mx-auto">
  <h2 class="text-xl font-semibold text-white mb-4">Svelte Counter Component</h2>

  <div class="text-center">
    <div class="text-3xl font-bold text-weeb-accent mb-4">
      {count}
    </div>

    <div class="flex gap-2 justify-center">
      <button
        on:click={decrement}
        class="px-4 py-2 bg-weeb-red text-white rounded hover:bg-weeb-red transition-colors"
      >
        -
      </button>

      <button
        on:click={reset}
        class="px-4 py-2 bg-weeb-surface text-white rounded hover:bg-weeb-surface transition-colors"
      >
        Reset
      </button>

      <button
        on:click={increment}
        class="px-4 py-2 bg-weeb-green text-white rounded hover:bg-weeb-green transition-colors"
      >
        +
      </button>
    </div>
  </div>

  <p class="text-weeb-fg-muted text-sm mt-4 text-center">
    This is a Svelte component running alongside React!
  </p>
</div>

<style>
  /* Component-specific styles can go here if needed */
  /* TailwindCSS classes are already available */
</style>