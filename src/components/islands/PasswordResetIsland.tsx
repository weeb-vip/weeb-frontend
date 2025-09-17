import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PasswordReset from '../../views/auth/password-reset';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: false,
    },
  },
});

export default function PasswordResetIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <PasswordReset />
    </QueryClientProvider>
  );
}