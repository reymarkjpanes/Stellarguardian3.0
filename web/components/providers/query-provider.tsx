"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * QueryProvider — wraps the app in a React Query context.
 *
 * Must be a Client Component because QueryClient and QueryClientProvider
 * depend on React context, which is not available in Server Components.
 *
 * QueryClient is created inside useState so each browser session gets
 * its own instance (prevents shared state across users in SSR).
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Don't refetch on window focus in development — reduces noise
            // while preserving the behavior in production.
            staleTime: 60 * 1000, // 1 minute
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
