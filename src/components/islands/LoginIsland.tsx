import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Login from '../../views/auth/login';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: false,
    },
  },
});

export default function LoginIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <Login />
    </QueryClientProvider>
  );
}