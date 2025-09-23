<script lang="ts">
  import { preferencesStore, type TitleLanguage } from '../stores/preferences';

  // Subscribe to preferences store
  $: preferences = $preferencesStore;

  function handleToggle() {
    preferencesStore.toggleTitleLanguage();
  }
</script>

<button
  on:click={handleToggle}
  class="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
  title="Switch between English and Japanese titles"
  aria-label="Toggle title language"
>
  <!-- Language Icon -->
  <svg
    class="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
    />
  </svg>

  <!-- Language Text -->
  <span class="hidden sm:inline">
    {preferences.titleLanguage === 'english' ? 'EN' : 'JP'}
  </span>
</button>