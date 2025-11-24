"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Button,
  Alert,
  AlertTitle,
  Skeleton,
  Stack,
} from "@mui/material";
import { ErrorOutlineRounded } from "@mui/icons-material";
import { LoadingSpinner } from "@/src/components/LoadingSpinner";
import OnboardingShell from "@/src/components/OnboardingShell";
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
  }, [placeId, triggerIngest, startPolling]);

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
      <OnboardingShell>
        <Card>
        <CardHeader>
            <Typography variant="h5" fontWeight={600}>
              Missing Business
            </Typography>
        </CardHeader>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
            No business selected. Please search for your business first.
              </Typography>
              <Button component={Link} href="/onboarding/business/search" variant="contained">
                Go to Search
              </Button>
            </Stack>
        </CardContent>
        </Card>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell>
      <Card>
      <CardHeader>
          <Typography variant="h5" fontWeight={600}>
            Analyzing your business...
          </Typography>
      </CardHeader>
        <CardContent>
          <Stack spacing={4}>
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 6 }}>
          {isLoading && !hasTimedOut ? (
            <>
                  <LoadingSpinner message="We're gathering insights about your business and competitors..." />
            </>
          ) : error || hasTimedOut ? (
            <>
                  <ErrorOutlineRounded sx={{ fontSize: 48, color: "error.main", mb: 2 }} />
                  <Typography variant="body1" color="error" fontWeight={500} textAlign="center" sx={{ mb: 2 }}>
                {error || 'Analysis is taking longer than expected'}
                  </Typography>
                  <Button onClick={handleRetry} variant="contained" sx={{ mt: 2 }}>
                Try Again
              </Button>
            </>
          ) : null}
            </Box>

        {/* Skeleton loader */}
        {isLoading && !hasTimedOut && (
              <Stack spacing={1.5}>
                <Skeleton variant="text" width="75%" height={24} />
                <Skeleton variant="text" width="66%" height={24} />
                <Skeleton variant="text" width="80%" height={24} />
              </Stack>
        )}
          </Stack>
      </CardContent>
      </Card>
    </OnboardingShell>
  );
}
