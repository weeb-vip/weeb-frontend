import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProfileAnime from '../../views/profile/anime';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: false,
    },
  },
});

export default function ProfileAnimeIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <ProfileAnime />
    </QueryClientProvider>
  );
}