<script lang="ts">
  import { untrack } from 'svelte';
  import ConfigProvider from '$lib/components/shell/ConfigProvider';
  import ConfigContextProbe from './ConfigContextProbe.svelte';
  import { configStore } from '$lib/stores/config';
  import { installOfflineFetch } from './provider-stubs';
  import type { IConfig } from '../../../config/interfaces';

  /**
   * `ConfigProvider` with a probe child inside it, which is the only way to see
   * what it does: it renders its children and nothing else.
   */
  let {
    /** Show the fallback branch instead: the store empty at the moment it reads. */
    fallback = false,
  }: { fallback?: boolean } = $props();

  let requests = $state(0);
  const restoreFetch = installOfflineFetch(() => (requests += 1));

  /*
    `.storybook/preview.ts` hydrates the store exactly as the root layout does,
    so the default story needs nothing. The fallback story is the surface that
    mounted before that ever happened -- and the store is a module singleton,
    so it is emptied for precisely as long as the provider takes to read it and
    handed straight back below.
  */
  const hydrated = untrack(() => configStore.get());
  if (untrack(() => fallback)) configStore.setConfig(null as unknown as IConfig);

  $effect(() => {
    // The provider read the store during its own initialisation, which is over
    // by the time any effect runs -- so the store can go back now.
    if (hydrated) configStore.setConfig(hydrated);
    return restoreFetch;
  });
</script>

<div class="frame">
  <ConfigProvider>
    <ConfigContextProbe {fallback} {requests} />
  </ConfigProvider>
</div>

<style>
  .frame {
    padding: 24px;
  }
</style>
