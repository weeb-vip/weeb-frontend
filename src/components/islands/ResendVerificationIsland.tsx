import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ResendVerification from '../../views/auth/resend-verification';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: false,
    },
  },
});

export default function ResendVerificationIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <ResendVerification />
    </QueryClientProvider>
  );
}