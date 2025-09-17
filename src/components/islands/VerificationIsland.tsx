import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Verification from '../../views/auth/verification';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: false,
    },
  },
});

export default function VerificationIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <Verification />
    </QueryClientProvider>
  );
}