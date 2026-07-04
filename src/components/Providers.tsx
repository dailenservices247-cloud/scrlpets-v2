"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AnalyticsConsent } from "@/components/privacy/AnalyticsConsent";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      {children}
      <AnalyticsConsent />
    </QueryClientProvider>
  );
}
