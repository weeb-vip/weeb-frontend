import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Header from '../Header';
import AuthHandler from '../../auth';
import { FlagsmithProvider } from 'flagsmith/react';
import flagsmith from 'flagsmith';

// Create a query client for the header
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: false,
    },
  },
});



export default function HeaderIsland() {
  const environmentID = typeof window !== 'undefined'
    ? (window as any).config?.flagsmith_environment_id || 'fallback'
    : 'fallback';
  return (

    <QueryClientProvider client={queryClient}>
      <FlagsmithProvider
        options={{
          environmentID,
          api: "https://flagsmith.weeb.vip/api/v1/",
        }}
        flagsmith={flagsmith}
      >
      <AuthHandler />
      <Header />
      </FlagsmithProvider>
    </QueryClientProvider>

  );
}
