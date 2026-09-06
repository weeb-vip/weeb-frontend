<script lang="ts">
  import type { Component } from 'svelte';

  /**
   * Test support: mounts `probe` as a real child of `provider`.
   *
   * A provider's whole contract is what a child sees, and `getContext` only
   * answers during a component's own initialisation -- a `createRawSnippet`
   * passed as `children` runs on the test's behalf, not the child's, so it
   * reads the wrong context. This is the smallest thing that puts one
   * component inside another.
   *
   * Lives in `__tests__/` rather than beside a component because both provider
   * suites use it; the coverage config already excludes the folder.
   */
  let {
    provider: Provider,
    probe: Probe,
    probeProps = {}
  }: {
    provider: Component<any>;
    probe: Component<any>;
    probeProps?: Record<string, unknown>;
  } = $props();
</script>

<Provider>
  <Probe {...probeProps} />
</Provider>
