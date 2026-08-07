<script lang="ts">
  import { QueryClientProvider } from '@tanstack/svelte-query';
  import { initializeQueryClient } from '../services/query-client';
  import CheckEmail from './CheckEmail.svelte';

  const queryClient = initializeQueryClient();
</script>

<QueryClientProvider client={queryClient}>
  <CheckEmail />
</QueryClientProvider>
