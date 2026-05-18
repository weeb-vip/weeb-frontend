<script lang="ts">
  import { setContext, onMount } from 'svelte';

  let config: any = {
    cdn_user_url: 'https://cdn.weeb.vip/users'
  };

  // Set context immediately with fallback config
  setContext('config', config);

  onMount(async () => {
    try {
      const response = await fetch('/config.json');
      const newConfig = await response.json();
      // Update the config object in place
      Object.assign(config, newConfig);
    } catch (error) {
      console.warn('Failed to load config:', error);
      // Keep using fallback config
    }
  });
</script>

<slot />