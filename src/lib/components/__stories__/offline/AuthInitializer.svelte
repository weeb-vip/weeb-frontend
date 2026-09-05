<script lang="ts">
  /**
   * Storybook's stand-in for AuthInitializer (see ./README.md).
   *
   * The real one runs a GraphQL user query on mount, wires a token refresher
   * and hangs stores off `window`. It renders nothing either way, so accepting
   * the prop and doing nothing with it is a complete substitute for a story.
   */
  let { ssrAuth = undefined }: { ssrAuth?: unknown } = $props();
</script>
