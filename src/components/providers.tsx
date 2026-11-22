'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Toaster } from 'sonner';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 min
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position={isMobile ? 'top-center' : 'bottom-right'}
        visibleToasts={isMobile ? 2 : 3}
        offset={isMobile ? 12 : 24}
        mobileOffset={12}
        theme="dark"
        richColors
        toastOptions={{
          duration: isMobile ? 2200 : 4000,
          style: {
            background: 'hsl(222 47% 8%)',
            border: '1px solid hsl(217 33% 16%)',
          },
        }}
      />
    </QueryClientProvider>
  );
}
