<script lang="ts">
  export let tag: string;
  export let className: string = '';
</script>

<span class="inline-block bg-weeb-surface rounded-md px-3 py-1 text-base font-semibold text-weeb-fg-secondary whitespace-nowrap transition-colors duration-300 {className}">
  {tag}
</span>