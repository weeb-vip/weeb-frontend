import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProfileSettings from '../../views/profile/settings';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: false,
    },
  },
});

export default function ProfileSettingsIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <ProfileSettings />
    </QueryClientProvider>
  );
}