"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertCircle } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const POLL_INTERVAL = 3000; // 3 seconds
const MAX_WAIT_TIME = 120000; // 2 minutes

export default function AnalyzingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const placeId = searchParams.get("placeId");
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get user info and trigger ingest
  const triggerIngest = useCallback(async () => {
    if (!placeId) return;

    try {
      const supabase = createBrowserSupabaseClient();
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error('Auth error:', userError);
        // Don't block if user fetch fails, just proceed without user_id/email
      }

      const currentUserId = user?.id || null;
      const currentUserEmail = user?.email || null;

      // If no user, redirect to sign-up
      if (!user) {
        router.push(`/sign-up?next=/onboarding/business/search`);
        return false;
      }

      // POST to ingest API
      const response = await fetch('/api/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          place_id: placeId,
          user_id: currentUserId,
          email: currentUserEmail,
        }),
      });

      const data = await response.json();

      if (!data.ok) {
        throw new Error(data.error || 'Failed to trigger ingestion');
      }

      // Ingest triggered successfully, start polling
      setIsLoading(true);
      setError(null);
      setHasTimedOut(false);
      
      return true;
    } catch (err: any) {
      console.error('Ingest error:', err);
      setError(err.message || 'Failed to start analysis. Please try again.');
      setIsLoading(false);
      return false;
    }
  }, [placeId, router]);

  // Poll for gbp_snapshots
  const pollForSnapshot = useCallback(async () => {
    if (!placeId) return;

    try {
      const supabase = createBrowserSupabaseClient();
      
      const { data, error: queryError } = await supabase
        .from('gbp_snapshots')
        .select('id, scraped_at')
        .eq('business_place_id', placeId)
        .order('scraped_at', { ascending: false })
        .limit(1);

      if (queryError) {
        console.error('Polling error:', queryError);
        // Don't set error state for query errors, just log and continue polling
        return false;
      }

      if (data && data.length > 0) {
        // Snapshot found! Stop polling and redirect
        router.push(`/onboarding/analysis?placeId=${encodeURIComponent(placeId)}`);
        return true;
      }

      return false;
    } catch (err: any) {
      console.error('Poll error:', err);
      return false;
    }
  }, [placeId, router]);

  // Start polling
  const startPolling = useCallback(() => {
    // Clear any existing intervals
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Set timeout for 2 minutes
    timeoutRef.current = setTimeout(() => {
      setHasTimedOut(true);
      setIsLoading(false);
      setError('Analysis is taking longer than expected. You can try again or check back later.');
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    }, MAX_WAIT_TIME);

    // Start polling immediately, then every 3 seconds
    pollForSnapshot().then((found) => {
      if (found) {
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      }
    });
    
    pollingIntervalRef.current = setInterval(() => {
      pollForSnapshot().then((found) => {
        if (found) {
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
        }
      });
    }, POLL_INTERVAL);
  }, [pollForSnapshot]);

  // Initial mount: trigger ingest and start polling
  useEffect(() => {
    if (!placeId) {
      return;
    }

    triggerIngest().then((success) => {
      if (success) {
        startPolling();
      }
    });

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [placeId, triggerIngest, startPolling]); // Only run on mount and if placeId changes

  // Retry handler
  const handleRetry = useCallback(() => {
    setError(null);
    setHasTimedOut(false);
    setIsLoading(true);
    
    triggerIngest().then((success) => {
      if (success) {
        startPolling();
      }
    });
  }, [triggerIngest, startPolling]);

  // If no placeId, show error and link back
  if (!placeId) {
    return (
      <div>
        <CardHeader>
          <CardTitle className="text-2xl">Missing Business</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            No business selected. Please search for your business first.
          </p>
          <Link href="/onboarding/business/search">
            <Button>Go to Search</Button>
          </Link>
        </CardContent>
      </div>
    );
  }

  return (
    <div>
      <CardHeader>
        <CardTitle className="text-2xl">Analyzing your business...</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          {isLoading && !hasTimedOut ? (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground text-center">
                We're gathering insights about your business and competitors...
              </p>
            </>
          ) : error || hasTimedOut ? (
            <>
              <AlertCircle className="h-12 w-12 text-destructive" />
              <p className="text-destructive text-center font-medium">
                {error || 'Analysis is taking longer than expected'}
              </p>
              <Button onClick={handleRetry} className="mt-4">
                Try Again
              </Button>
            </>
          ) : null}
        </div>

        {/* Skeleton loader */}
        {isLoading && !hasTimedOut && (
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded-lg animate-pulse w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded-lg animate-pulse w-2/3"></div>
            <div className="h-4 bg-gray-200 rounded-lg animate-pulse w-4/5"></div>
          </div>
        )}
      </CardContent>
    </div>
  );
}
