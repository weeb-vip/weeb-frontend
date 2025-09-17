import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CurrentlyAiringCalendarPage from '../../views/CurrentlyAiring/Calendar';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: false,
    },
  },
});

export default function CurrentlyAiringCalendarIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <CurrentlyAiringCalendarPage />
    </QueryClientProvider>
  );
}