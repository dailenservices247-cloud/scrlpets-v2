"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { initAnalytics } from "@/lib/analytics";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  useEffect(() => {
    initAnalytics();
  }, []);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
