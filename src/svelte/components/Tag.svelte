<script lang="ts">
  export let tag: string;
  export let className: string = '';
</script>

<span class="inline-block bg-gray-200 dark:bg-gray-600 rounded-md px-3 py-1 text-base font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap transition-colors duration-300 {className}">
  {tag}
</span>