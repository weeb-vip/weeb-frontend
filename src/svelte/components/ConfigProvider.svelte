<script lang="ts">
  import { setContext, type Snippet } from 'svelte';
  import { configStore } from '../stores/config';
  import type { IConfig } from '../../config/interfaces';

  let { children }: { children?: Snippet } = $props();

  // Config is already hydrated by the root layout from build-time config, so
  // read it from the store instead of re-fetching /config.json. Fall back to a
  // minimal default only if the store somehow isn't populated yet.
  const config = configStore.get() ?? ({ cdn_user_url: 'https://cdn.weeb.vip/users' } as IConfig);

  setContext('config', config);
</script>

{@render children?.()}
