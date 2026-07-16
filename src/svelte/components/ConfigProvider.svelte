<script lang="ts">
  import { setContext } from 'svelte';
  import { configStore } from '../stores/config';

  // Config is already hydrated by the root layout from build-time config, so
  // read it from the store instead of re-fetching /config.json. Fall back to a
  // minimal default only if the store somehow isn't populated yet.
  const config: any = configStore.get() ?? {
    cdn_user_url: 'https://cdn.weeb.vip/users'
  };

  setContext('config', config);
</script>

<slot />