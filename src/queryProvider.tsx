import {
  useQuery,
  useMutation,
  useQueryClient,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import React from "react";
import {ReactQueryDevtools} from "@tanstack/react-query-devtools";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // default: true
    },
  }
})

export default function QueryProvider({children}: { children: React.ReactNode }) {
  const showDevtools = import.meta.env.VITE_ENABLE_DEVTOOLS === 'true'
  
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {showDevtools && <ReactQueryDevtools initialIsOpen={true} />}
    </QueryClientProvider>
  )
}