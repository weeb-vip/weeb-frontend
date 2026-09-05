<script lang="ts">
  let { tag, className = '' }: { tag: string; className?: string } = $props();
</script>

<span class="inline-block bg-weeb-surface rounded-md px-3 py-1 text-base font-semibold text-weeb-fg-secondary whitespace-nowrap transition-colors duration-300 {className}">
  {tag}
</span>
