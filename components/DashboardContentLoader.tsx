"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { Loader2 } from "lucide-react";

// Create a context to share loading state
let globalLoadingState: { isLoading: boolean; setLoading: (loading: boolean) => void } | null = null;

export function setGlobalLoading(loading: boolean) {
  if (globalLoadingState) {
    globalLoadingState.setLoading(loading);
  }
}

export function DashboardContentLoader({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(false);
  const previousPathname = useRef(pathname);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef(true);

  // Set up global loading state
  useEffect(() => {
    globalLoadingState = { isLoading, setLoading: setIsLoading };
    return () => {
      globalLoadingState = null;
    };
  }, [isLoading]);

  useEffect(() => {
    // Skip on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      previousPathname.current = pathname;
      return;
    }

    // When pathname changes, show loading briefly
    if (pathname !== previousPathname.current) {
      // Clear any existing timeout
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }

      // Show loading immediately
      setIsLoading(true);
      
      // Update the previous pathname
      previousPathname.current = pathname;

      // Hide loading very quickly - Next.js App Router is fast
      // Just show a brief flash to indicate navigation started
      loadingTimeoutRef.current = setTimeout(() => {
        setIsLoading(false);
      }, 50); // Very short - just 50ms for minimal visual feedback
      
      return () => {
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
        }
      };
    }
  }, [pathname]);

  return (
    <div className="relative min-h-[400px]">
      {isLoading && (
        <div className="fixed left-64 top-0 right-0 bottom-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-base font-medium text-foreground">Loading page...</p>
          </div>
        </div>
      )}
      <div className={isLoading ? "opacity-50 pointer-events-none" : "opacity-100 transition-opacity duration-150"}>
        {children}
      </div>
    </div>
  );
}

