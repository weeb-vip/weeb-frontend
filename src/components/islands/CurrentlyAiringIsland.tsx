import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CurrentlyAiringPage from '../../views/CurrentlyAiring';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: false,
    },
  },
});

export default function CurrentlyAiringIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <CurrentlyAiringPage />
    </QueryClientProvider>
  );
}