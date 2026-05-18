<script lang="ts">
  import { QueryClientProvider } from '@tanstack/svelte-query';
  import { initializeQueryClient } from '../services/query-client';
  import ResendVerification from './ResendVerification.svelte';

  const queryClient = initializeQueryClient();
</script>

<QueryClientProvider client={queryClient}>
  <ResendVerification />
</QueryClientProvider>