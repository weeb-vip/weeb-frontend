<script lang="ts">
  import { TitleLanguageToggleBloc } from './TitleLanguageToggle.bloc.svelte';

  /**
   * Defaults to a bloc bound to the real preferences store, so call sites stay
   * `<TitleLanguageToggle />`. Stories and tests inject their own.
   */
  let { bloc = new TitleLanguageToggleBloc() }: { bloc?: TitleLanguageToggleBloc } = $props();
</script>

<button
  onclick={() => bloc.toggle()}
  class="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-weeb-fg-secondary hover:text-weeb-fg hover:bg-weeb-surface-hover rounded-lg transition-colors duration-200"
  title={bloc.actionLabel}
  aria-label={bloc.actionLabel}
>
  <!-- Language Icon -->
  <svg
    aria-hidden="true"
    focusable="false"
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
  <span class="hidden sm:inline">{bloc.shortLabel}</span>
</button>
