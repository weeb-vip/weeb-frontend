import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PasswordResetRequest from '../../views/auth/password-reset-request';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: false,
    },
  },
});

export default function PasswordResetRequestIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <PasswordResetRequest />
    </QueryClientProvider>
  );
}