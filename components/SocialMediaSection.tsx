"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Instagram, Facebook, Loader2, Plus, X, RefreshCw, Edit2, Check, X as XIcon, Star, Sparkles, AlertCircle, Heart } from "lucide-react";
import { useToast } from "@/components/Toast";
import { BenchmarkScale, BenchmarkScaleData } from "@/components/social/BenchmarkScale";
import { BenchmarkBreakdownDialog } from "@/components/social/BenchmarkBreakdownDialog";
import { Box, CircularProgress, Typography, Button, IconButton } from "@mui/material";

interface SocialSnapshot {
  network: 'instagram' | 'tiktok' | 'facebook';
  posts_total: number | null;
  posts_last_30d: number | null;
  days_since_last_post: number | null;
  engagement_rate: number | null;
  followers: number | null;
  snapshot_ts: string;
}

interface SocialProfile {
  network: 'instagram' | 'tiktok' | 'facebook';
  handle: string;
  profile_url: string | null;
}

interface GoogleReviewSnapshot {
  negative_reviews: number;
  positive_reviews: number;
  days_since_last_review: number | null;
  total_reviews: number;
  reviews_distribution: {
    oneStar: number;
    twoStar: number;
    threeStar: number;
    fourStar: number;
    fiveStar: number;
  } | null;
  negative_summary: string | null;
  positive_summary: string | null;
  snapshot_ts: string;
}

interface SocialMediaSectionProps {
  businessId: string;
  initialSnapshots: SocialSnapshot[];
  initialProfiles: SocialProfile[];
  googleReviewSnapshot?: GoogleReviewSnapshot | null;
}

const NETWORK_CONFIG = {
  instagram: {
    label: 'Instagram',
    icon: Instagram,
    placeholder: 'yourbrand',
    prefix: 'instagram.com/@',
    endpoint: '/api/social/instagram/analyze',
  },
  tiktok: {
    label: 'TikTok',
    icon: null, // Custom SVG
    placeholder: 'yourbrand',
    prefix: 'tiktok.com/@',
    endpoint: '/api/social/tiktok/analyze',
  },
  facebook: {
    label: 'Facebook',
    icon: Facebook,
    placeholder: 'yourbrand',
    prefix: 'facebook.com/',
    endpoint: '/api/social/facebook/analyze',
  },
};

export function SocialMediaSection({ businessId, initialSnapshots, initialProfiles, googleReviewSnapshot }: SocialMediaSectionProps) {
  const { addToast } = useToast();
  const [snapshots, setSnapshots] = useState<SocialSnapshot[]>(initialSnapshots);
  const [profiles, setProfiles] = useState<SocialProfile[]>(initialProfiles);
  const [addingNetwork, setAddingNetwork] = useState<'instagram' | 'tiktok' | 'facebook' | null>(null);
  const [editingNetwork, setEditingNetwork] = useState<'instagram' | 'tiktok' | 'facebook' | null>(null);
  const [refreshingNetworks, setRefreshingNetworks] = useState<Set<'instagram' | 'tiktok' | 'facebook'>>(new Set());
  const [handleValue, setHandleValue] = useState('');
  const [editHandleValues, setEditHandleValues] = useState<Record<'instagram' | 'tiktok' | 'facebook', string>>({
    instagram: '',
    tiktok: '',
    facebook: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pollingNetworks, setPollingNetworks] = useState<Set<'instagram' | 'tiktok' | 'facebook'>>(new Set());
  const [timeoutNetworks, setTimeoutNetworks] = useState<Set<'instagram' | 'tiktok' | 'facebook'>>(new Set());
  
  // Benchmark scores state
  const [benchmarkScores, setBenchmarkScores] = useState<Record<'instagram' | 'tiktok' | 'facebook', { 
    current: number | null; 
    benchmark: number | null; 
    loading: boolean;
    reasoning?: string;
    benchmarkReasoning?: string;
  }>>({
    instagram: { current: null, benchmark: null, loading: false },
    tiktok: { current: null, benchmark: null, loading: false },
    facebook: { current: null, benchmark: null, loading: false },
  });

  // Breakdown dialog state
  const [breakdownDialog, setBreakdownDialog] = useState<{
    open: boolean;
    network: 'instagram' | 'tiktok' | 'facebook' | null;
  }>({
    open: false,
    network: null,
  });
  
  // Initialize network handles from initial profiles
  const [networkHandles, setNetworkHandles] = useState<Record<'instagram' | 'tiktok' | 'facebook', string>>(() => {
    const handles: Record<'instagram' | 'tiktok' | 'facebook', string> = {
      instagram: '',
      tiktok: '',
      facebook: '',
    };
    initialProfiles.forEach(profile => {
      handles[profile.network] = profile.handle;
    });
    return handles;
  });

  // Removed automatic polling - data is stored and only refreshed manually

  const handleAddAccount = async (network: 'instagram' | 'tiktok' | 'facebook') => {
    if (!handleValue.trim()) {
      addToast('Please enter a handle', 'error');
      return;
    }

    setIsSubmitting(true);
    const config = NETWORK_CONFIG[network];

    try {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placeId: businessId,
          handle: handleValue.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add account');
      }

      // Add to profiles list optimistically
      const newProfile = {
        network,
        handle: handleValue.trim(),
        profile_url: null,
      };
      setProfiles([...profiles, newProfile]);
      setNetworkHandles(prev => ({ ...prev, [network]: handleValue.trim() }));

      addToast(`${config.label} account added. Click refresh to see analysis results.`, 'success');
      setHandleValue('');
      setAddingNetwork(null);
    } catch (error: any) {
      console.error(`[SocialMediaSection] Failed to add ${network}:`, error);
      addToast(error.message || `Failed to add ${config.label} account`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefreshBenchmark = async (network: 'instagram' | 'tiktok' | 'facebook') => {
    try {
      setBenchmarkScores(prev => ({
        ...prev,
        [network]: { ...prev[network], loading: true },
      }));

      // Fetch current score with refresh flag
      const scoreResponse = await fetch(`/api/social/benchmark/analyze?refresh=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, network }),
      });

      if (scoreResponse.ok) {
        const scoreData = await scoreResponse.json();
        if (scoreData.ok && scoreData.data) {
          // Fetch industry benchmark with refresh flag
          const benchmarkResponse = await fetch(`/api/social/benchmark/industry-standard?refresh=true`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ businessId, network }),
          });

          if (benchmarkResponse.ok) {
            const benchmarkData = await benchmarkResponse.json();
            if (benchmarkData.ok && benchmarkData.data) {
              setBenchmarkScores(prev => ({
                ...prev,
                [network]: {
                  current: scoreData.data.score,
                  benchmark: benchmarkData.data.score,
                  loading: false,
                  reasoning: scoreData.data.reasoning,
                  benchmarkReasoning: benchmarkData.data.reasoning,
                },
              }));
              addToast(`${network} benchmark scores refreshed`, 'success');
              return;
            }
          }
        }
      }

      throw new Error('Failed to refresh benchmark scores');
    } catch (error: any) {
      console.error(`[SocialMediaSection] Error refreshing benchmark for ${network}:`, error);
      addToast(error.message || `Failed to refresh ${network} benchmark`, 'error');
      setBenchmarkScores(prev => ({
        ...prev,
        [network]: { ...prev[network], loading: false },
      }));
    }
  };

  const handleRefreshAccount = async (network: 'instagram' | 'tiktok' | 'facebook') => {
    const profile = profiles.find(p => p.network === network);
    if (!profile) {
      addToast('No account found to refresh', 'error');
      return;
    }

    setRefreshingNetworks(prev => new Set(prev).add(network));
    const config = NETWORK_CONFIG[network];

    try {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placeId: businessId,
          handle: profile.handle,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to refresh account');
      }

      // Remove existing snapshot - user will need to manually refresh to see new data
      setSnapshots(prev => prev.filter(s => s.network !== network));

      addToast(`${config.label} refresh started. Please refresh the page in a moment to see results.`, 'success');
      
      // Fetch snapshot after a short delay (analysis may take a moment)
      setTimeout(async () => {
        try {
          const snapshotResponse = await fetch(`/api/social/snapshots?businessId=${businessId}&network=${network}`);
          const snapshotResult = await snapshotResponse.json();

          if (snapshotResponse.ok && snapshotResult.ok && snapshotResult.data) {
            const snapshotData = {
              network: snapshotResult.data.network,
              posts_total: snapshotResult.data.posts_total,
              posts_last_30d: snapshotResult.data.posts_last_30d,
              days_since_last_post: snapshotResult.data.days_since_last_post,
              engagement_rate: snapshotResult.data.engagement_rate,
              followers: snapshotResult.data.followers,
              snapshot_ts: snapshotResult.data.snapshot_ts,
            };
            setSnapshots(prev => {
              const updated = [...prev];
              const idx = updated.findIndex(s => s.network === network);
              if (idx >= 0) {
                updated[idx] = snapshotData;
              } else {
                updated.push(snapshotData);
              }
              return updated;
            });
            addToast(`${config.label} data updated.`, 'success');
          }
        } catch (err) {
          console.warn(`[SocialMediaSection] Error fetching ${network} snapshot:`, err);
        }
      }, 5000); // Wait 5 seconds before checking
    } catch (error: any) {
      console.error(`[SocialMediaSection] Failed to refresh ${network}:`, error);
      addToast(error.message || `Failed to refresh ${config.label} account`, 'error');
    } finally {
      setRefreshingNetworks(prev => {
        const updated = new Set(prev);
        updated.delete(network);
        return updated;
      });
    }
  };

  const handleUpdateAccount = async (network: 'instagram' | 'tiktok' | 'facebook') => {
    const newHandle = editHandleValues[network]?.trim();
    if (!newHandle) {
      addToast('Please enter a handle', 'error');
      return;
    }

    const profile = profiles.find(p => p.network === network);
    if (profile && profile.handle === newHandle) {
      // No change, just cancel edit
      setEditingNetwork(null);
      return;
    }

    setIsSubmitting(true);
    const config = NETWORK_CONFIG[network];

    try {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placeId: businessId,
          handle: newHandle,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update account');
      }

      // Update profile
      setProfiles(prev => prev.map(p => 
        p.network === network 
          ? { ...p, handle: newHandle, profile_url: null }
          : p
      ));
      setNetworkHandles(prev => ({ ...prev, [network]: newHandle }));

      // Remove existing snapshot - user will need to manually refresh to see new data
      setSnapshots(prev => prev.filter(s => s.network !== network));
      setPollingNetworks(prev => new Set(prev).add(network));
      setTimeoutNetworks(prev => {
        const updated = new Set(prev);
        updated.delete(network);
        return updated;
      });

      addToast(`${config.label} account updated. Fetching latest data...`, 'success');
      setEditingNetwork(null);
    } catch (error: any) {
      console.error(`[SocialMediaSection] Failed to update ${network}:`, error);
      addToast(error.message || `Failed to update ${config.label} account`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatEngagementRate = (rate: number | null): string => {
    if (rate === null) return 'N/A';
    return `${(rate * 100).toFixed(2)}%`;
  };

  const formatNumber = (num: number | null): string => {
    if (num === null) return 'N/A';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // Fetch benchmark scores when snapshots are available
  useEffect(() => {
    const fetchBenchmarkScores = async () => {
      for (const network of ['instagram', 'tiktok', 'facebook'] as const) {
        const snapshot = snapshots.find(s => s.network === network);
        
        // Reset scores if no snapshot
        if (!snapshot) {
          setBenchmarkScores(prev => {
            if (prev[network].current === null && prev[network].benchmark === null) return prev;
            return {
              ...prev,
              [network]: { current: null, benchmark: null, loading: false },
            };
          });
          continue;
        }

        // Check if we need to fetch (using a function to read current state)
        setBenchmarkScores(prev => {
          const currentState = prev[network];
          // Skip if already loading or already fetched
          if (currentState.loading || (currentState.current !== null && currentState.benchmark !== null)) {
            return prev;
          }
          // Set loading and fetch
          (async () => {
            try {
              // Fetch current score
              const scoreResponse = await fetch('/api/social/benchmark/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ businessId, network }),
              });

              if (scoreResponse.ok) {
                const scoreData = await scoreResponse.json();
                if (scoreData.ok && scoreData.data) {
                  // Fetch industry benchmark
                  const benchmarkResponse = await fetch('/api/social/benchmark/industry-standard', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ businessId, network }),
                  });

                  if (benchmarkResponse.ok) {
                    const benchmarkData = await benchmarkResponse.json();
                    if (benchmarkData.ok && benchmarkData.data) {
                      setBenchmarkScores(prev => ({
                        ...prev,
                        [network]: {
                          current: scoreData.data.score,
                          benchmark: benchmarkData.data.score,
                          loading: false,
                          reasoning: scoreData.data.reasoning,
                          benchmarkReasoning: benchmarkData.data.reasoning,
                        },
                      }));
                      return;
                    }
                  }
                }
              }

              // If we get here, something failed
              setBenchmarkScores(prev => ({
                ...prev,
                [network]: { ...prev[network], loading: false },
              }));
            } catch (error) {
              console.error(`[SocialMediaSection] Error fetching benchmark for ${network}:`, error);
              setBenchmarkScores(prev => ({
                ...prev,
                [network]: { ...prev[network], loading: false },
              }));
            }
          })();
          
          return {
            ...prev,
            [network]: { ...currentState, loading: true },
          };
        });
      }
    };

    fetchBenchmarkScores();
  }, [snapshots, businessId]);

  const [googleSnapshot, setGoogleSnapshot] = useState<GoogleReviewSnapshot | null>(googleReviewSnapshot || null);
  const [pollingGoogle, setPollingGoogle] = useState(false);
  const [googleTimeout, setGoogleTimeout] = useState(false);
  const [regeneratingSummaries, setRegeneratingSummaries] = useState(false);
  const hasTriggeredGoogleAnalysisRef = useRef(false);

  // Removed automatic Google reviews analysis - user must manually trigger refresh

  const handleRegenerateSummaries = async () => {
    if (!googleSnapshot) return;

    setRegeneratingSummaries(true);
    try {
      const response = await fetch("/api/google/reviews/regenerate-summaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Failed to regenerate summaries");
      }

      // Update the snapshot with new summaries
      setGoogleSnapshot({
        ...googleSnapshot,
        negative_summary: result.data.negative_summary,
        positive_summary: result.data.positive_summary,
      });

      addToast("Review summaries regenerated successfully", "success");
    } catch (error: any) {
      console.error("[SocialMediaSection] Error regenerating summaries:", error);
      addToast(error.message || "Failed to regenerate summaries", "error");
    } finally {
      setRegeneratingSummaries(false);
    }
  };

  const handleRefreshGoogle = async () => {
    try {
      // Reset timeout state and allow retry
      setGoogleTimeout(false);
      hasTriggeredGoogleAnalysisRef.current = false;
      
      // Trigger analysis
      const response = await fetch('/api/google/reviews/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          placeId: businessId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to trigger analysis');
      }

      addToast('Google reviews analysis started. This may take a moment.', 'success');

      // Start polling
      setPollingGoogle(true);
      hasTriggeredGoogleAnalysisRef.current = true;
      let pollCount = 0;
      const maxPolls = 15;
      const MAX_POLL_TIME = 60000;
      const startTime = Date.now();

      const poll = async () => {
        if (Date.now() - startTime > MAX_POLL_TIME) {
          setPollingGoogle(false);
          setGoogleTimeout(true);
          return;
        }

        pollCount++;
        if (pollCount > maxPolls) {
          setPollingGoogle(false);
          setGoogleTimeout(true);
          return;
        }

        try {
          const response = await fetch(`/api/google/reviews/snapshots?businessId=${businessId}`);
          const result = await response.json();

          if (response.ok && result.ok && result.data) {
            setGoogleSnapshot(result.data);
            setPollingGoogle(false);
            setGoogleTimeout(false);
            addToast('Google reviews data updated', 'success');
            return;
          }
        } catch (err) {
          console.warn('[SocialMediaSection] Error polling Google reviews:', err);
        }

        if (pollCount < maxPolls) {
          setTimeout(poll, 4000);
        } else {
          setPollingGoogle(false);
          setGoogleTimeout(true);
        }
      };

      setTimeout(poll, 4000);
    } catch (error: any) {
      addToast(error.message || 'Failed to refresh Google reviews', 'error');
      setPollingGoogle(false);
    }
  };

  return (
    <div className="space-y-2" style={{ display: "flex", flexDirection: "column" }}>
      {/* Google Reviews Card - Full width on top */}
      <Card className="rounded-2xl shadow-lg" style={{ flexShrink: 0 }}>
        <CardHeader className="pb-2 pt-3 px-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
              Google
            </CardTitle>
            {googleSnapshot && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <IconButton
                  size="small"
                  onClick={handleRegenerateSummaries}
                  disabled={regeneratingSummaries}
                  sx={{
                    width: 24,
                    height: 24,
                    color: (theme) => theme.palette.onSurfaceVariant?.main || "#444A41",
                    "&:hover": {
                      backgroundColor: (theme) => theme.palette.surfaceContainerHigh?.main || "#F6FAF0",
                    },
                  }}
                  title="Regenerate AI summaries"
                >
                  {regeneratingSummaries ? (
                    <CircularProgress size={12} sx={{ color: "inherit" }} />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                </IconButton>
                <IconButton
                  size="small"
                  onClick={handleRefreshGoogle}
                  disabled={pollingGoogle}
                  sx={{
                    width: 24,
                    height: 24,
                    color: (theme) => theme.palette.onSurfaceVariant?.main || "#444A41",
                    "&:hover": {
                      backgroundColor: (theme) => theme.palette.surfaceContainerHigh?.main || "#F6FAF0",
                    },
                  }}
                  title="Refresh data"
                >
                  {pollingGoogle ? (
                    <CircularProgress size={12} sx={{ color: "inherit" }} />
                  ) : (
                    <RefreshCw className="w-3 h-3" />
                  )}
                </IconButton>
              </Box>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          {googleSnapshot ? (
            <div className="space-y-3 text-sm">
              {googleSnapshot.negative_summary && (
                <div className="bg-red-50 border-l-4 border-red-500 rounded-r-lg p-3 shadow-sm">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-900 leading-relaxed font-medium">
                      {googleSnapshot.negative_summary}
                    </p>
                  </div>
                </div>
              )}
              {googleSnapshot.positive_summary && (
                <div className="bg-green-50 border-l-4 border-green-500 rounded-r-lg p-3 shadow-sm">
                  <div className="flex items-start gap-3">
                    <Heart className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5 fill-green-600" />
                    <p className="text-sm text-green-900 leading-relaxed font-medium">
                      {googleSnapshot.positive_summary}
                    </p>
                  </div>
                </div>
              )}
              <div className="pt-2 border-t border-gray-200">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Days since last review:</span>
                  <span className="font-medium">
                    {googleSnapshot.days_since_last_review !== null ? googleSnapshot.days_since_last_review : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          ) : googleTimeout ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={{ 
                color: (theme) => theme.palette.error.main,
                bgcolor: (theme) => theme.palette.error.light || "#FFEBEE",
                border: '1px solid',
                borderColor: (theme) => theme.palette.error.main,
                borderRadius: 2,
                p: 1.5,
              }}>
                <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5, fontSize: '0.75rem' }}>
                  Analysis timed out
                </Typography>
                <Typography variant="caption" sx={{ color: (theme) => theme.palette.error.dark, fontSize: '0.6875rem' }}>
                  The analysis is taking longer than expected. You can try again or check back later.
                </Typography>
              </Box>
              <Button
                variant="outlined"
                size="small"
                onClick={handleRefreshGoogle}
                fullWidth
                startIcon={<RefreshCw className="w-4 h-4" />}
                sx={{
                  borderRadius: 999,
                  textTransform: "none",
                  fontWeight: 500,
                  fontSize: "0.875rem",
                  color: (theme) => theme.palette.onSurface?.main || "#1B1C19",
                  borderColor: (theme) => theme.palette.outlineVariant?.main || "#DDE4D8",
                  backgroundColor: (theme) => theme.palette.surfaceContainer?.main || "#FFFFFF",
                  "&:hover": {
                    backgroundColor: (theme) => theme.palette.surfaceContainerHigh?.main || "#F6FAF0",
                    borderColor: (theme) => theme.palette.outline?.main || "#C7CEC3",
                  },
                }}
              >
                Retry Analysis
              </Button>
            </Box>
          ) : pollingGoogle ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={16} />
              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                Analyzing...
              </Typography>
            </Box>
          ) : (
            <Button
              variant="outlined"
              size="small"
              onClick={handleRefreshGoogle}
              fullWidth
              startIcon={<Plus className="w-4 h-4" />}
              sx={{
                borderRadius: 999,
                textTransform: "none",
                fontWeight: 500,
                fontSize: "0.875rem",
                color: (theme) => theme.palette.onSurface?.main || "#1B1C19",
                borderColor: (theme) => theme.palette.outlineVariant?.main || "#DDE4D8",
                backgroundColor: (theme) => theme.palette.surfaceContainer?.main || "#FFFFFF",
                "&:hover": {
                  backgroundColor: (theme) => theme.palette.surfaceContainerHigh?.main || "#F6FAF0",
                  borderColor: (theme) => theme.palette.outline?.main || "#C7CEC3",
                },
              }}
            >
              Analyze Reviews
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Social Media Benchmark Scales */}
      <Card className="rounded-2xl shadow-lg" style={{ flexShrink: 0 }}>
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-sm font-semibold">Social Media Performance</CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 space-y-4">
          {(['instagram', 'tiktok', 'facebook'] as const).map((network) => {
            const config = NETWORK_CONFIG[network];
            const snapshot = snapshots.find(s => s.network === network);
            const profile = profiles.find(p => p.network === network);
            const scores = benchmarkScores[network];

            // Show benchmark scale if we have both scores
            if (scores.current !== null && scores.benchmark !== null) {
              const scaleData: BenchmarkScaleData = {
                min: 0,
                max: 100,
                current: {
                  value: scores.current,
                  label: "Where you are",
                },
                benchmark: {
                  value: scores.benchmark,
                  label: "Industry standard",
                },
                showTicks: false,
                endCaps: true,
                orientation: "horizontal",
              };

              return (
                <Box key={network} sx={{ borderBottom: network !== 'facebook' ? '1px solid' : 'none', borderColor: 'divider', pb: network !== 'facebook' ? 2 : 0, position: 'relative' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="bodyMedium" sx={{ textTransform: 'capitalize', fontWeight: 600 }}>
                      {network}
                    </Typography>
                    {profile && (
                      <IconButton
                        size="small"
                        onClick={() => handleRefreshBenchmark(network)}
                        disabled={benchmarkScores[network].loading}
                        sx={{
                          width: 24,
                          height: 24,
                          color: (theme) => theme.palette.onSurfaceVariant?.main || "#444A41",
                          "&:hover": {
                            backgroundColor: (theme) => theme.palette.surfaceContainerHigh?.main || "#F6FAF0",
                          },
                        }}
                        title="Refresh benchmark analysis"
                      >
                        {benchmarkScores[network].loading ? (
                          <CircularProgress size={12} sx={{ color: "inherit" }} />
                        ) : (
                          <RefreshCw className="w-3 h-3" />
                        )}
                      </IconButton>
                    )}
                  </Box>
                  <Box
                    onClick={() => setBreakdownDialog({ open: true, network })}
                    sx={{
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      borderRadius: 2,
                      p: 2,
                      mt: -2,
                      mb: -2,
                      border: '1px solid transparent',
                      '&:hover': {
                        backgroundColor: (theme) => theme.palette.surfaceContainerHigh?.main || "#F6FAF0",
                        transform: 'translateY(-4px) scale(1.02)',
                        boxShadow: '0px 8px 16px rgba(0,0,0,0.12)',
                        borderColor: (theme) => theme.palette.primary.main,
                        '& .benchmark-hint': {
                          opacity: 1,
                          transform: 'translateY(0)',
                        },
                      },
                    }}
                  >
                    <Box
                      className="benchmark-hint"
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        opacity: 0,
                        transform: 'translateY(-4px)',
                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                        pointerEvents: 'none',
                        zIndex: 10,
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          fontSize: '0.6875rem',
                          color: (theme) => theme.palette.primary.main,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}
                      >
                        Click for details
                      </Typography>
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          backgroundColor: (theme) => theme.palette.primary.main,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: (theme) => theme.palette.onPrimary?.main || "#FFFFFF",
                          fontSize: '0.625rem',
                          fontWeight: 700,
                        }}
                      >
                        i
                      </Box>
                    </Box>
                    <BenchmarkScale data={scaleData} network={network} />
                  </Box>
                </Box>
              );
            }

            // Show loading state
            if (scores.loading || (snapshot && (scores.current === null || scores.benchmark === null))) {
              return (
                <Box key={network} sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="bodyMedium" sx={{ textTransform: 'capitalize', minWidth: 80 }}>
                    {network}
                  </Typography>
                  <CircularProgress size={20} />
                  <Typography variant="caption" color="text.secondary">
                    Analyzing performance...
                  </Typography>
                </Box>
              );
            }

            // Show add account button or form if no profile
            if (!profile) {
              if (addingNetwork === network) {
                return (
                  <Box key={network} sx={{ py: 2, space: 1.5 }}>
                    <Typography variant="bodyMedium" sx={{ textTransform: 'capitalize', mb: 1.5, fontWeight: 600 }}>
                      {network}
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                          {config.prefix}
                        </Typography>
                        <Input
                          type="text"
                          placeholder={config.placeholder}
                          value={handleValue}
                          onChange={(e) => setHandleValue(e.target.value)}
                          className="flex-1 h-8 text-sm"
                          autoFocus
                        />
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1.5 }}>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => handleAddAccount(network)}
                          disabled={isSubmitting || !handleValue.trim()}
                          startIcon={isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                          sx={{
                            borderRadius: 999,
                            textTransform: "none",
                            fontWeight: 500,
                            fontSize: "0.75rem",
                            backgroundColor: (theme) => theme.palette.primary.main,
                            color: (theme) => theme.palette.onPrimary?.main || "#FFFFFF",
                            "&:hover": {
                              backgroundColor: (theme) => theme.palette.primary.dark || "#005005",
                            },
                            "&.Mui-disabled": {
                              backgroundColor: (theme) => theme.palette.surfaceContainerHigh?.main || "#F6FAF0",
                              color: (theme) => theme.palette.onSurfaceVariant?.main || "#444A41",
                            },
                          }}
                        >
                          {isSubmitting ? 'Adding...' : 'Add'}
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => {
                            setAddingNetwork(null);
                            setHandleValue('');
                          }}
                          disabled={isSubmitting}
                          sx={{
                            borderRadius: 999,
                            textTransform: "none",
                            fontWeight: 500,
                            fontSize: "0.75rem",
                            color: (theme) => theme.palette.onSurface?.main || "#1B1C19",
                            borderColor: (theme) => theme.palette.outlineVariant?.main || "#DDE4D8",
                            backgroundColor: (theme) => theme.palette.surfaceContainer?.main || "#FFFFFF",
                            "&:hover": {
                              backgroundColor: (theme) => theme.palette.surfaceContainerHigh?.main || "#F6FAF0",
                              borderColor: (theme) => theme.palette.outline?.main || "#C7CEC3",
                            },
                          }}
                        >
                          Cancel
                        </Button>
                      </Box>
                    </Box>
                  </Box>
                );
              }
              
              return (
                <Box key={network} sx={{ py: 2 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setAddingNetwork(network)}
                    startIcon={<Plus className="w-4 h-4" />}
                    fullWidth
                    sx={{
                      borderRadius: 999,
                      textTransform: "none",
                      fontWeight: 500,
                      fontSize: "0.875rem",
                      color: (theme) => theme.palette.onSurface?.main || "#1B1C19",
                      borderColor: (theme) => theme.palette.outlineVariant?.main || "#DDE4D8",
                      backgroundColor: (theme) => theme.palette.surfaceContainer?.main || "#FFFFFF",
                      "&:hover": {
                        backgroundColor: (theme) => theme.palette.surfaceContainerHigh?.main || "#F6FAF0",
                        borderColor: (theme) => theme.palette.outline?.main || "#C7CEC3",
                      },
                    }}
                  >
                    Add {config.label}
                  </Button>
                </Box>
              );
            }

            // Show waiting for snapshot
            if (!snapshot) {
              return (
                <Box key={network} sx={{ py: 2 }}>
                  <Typography variant="bodyMedium" sx={{ textTransform: 'capitalize', mb: 1 }}>
                    {network}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {pollingNetworks.has(network) ? 'Analyzing...' : 'Waiting for data...'}
                  </Typography>
                </Box>
              );
            }

            return null;
          })}
        </CardContent>
      </Card>

      {/* Breakdown Dialog */}
      {breakdownDialog.network && (
        <BenchmarkBreakdownDialog
          open={breakdownDialog.open}
          onClose={() => setBreakdownDialog({ open: false, network: null })}
          network={breakdownDialog.network}
          currentScore={benchmarkScores[breakdownDialog.network].current || 0}
          benchmarkScore={benchmarkScores[breakdownDialog.network].benchmark || 0}
          reasoning={benchmarkScores[breakdownDialog.network].reasoning}
          benchmarkReasoning={benchmarkScores[breakdownDialog.network].benchmarkReasoning}
          snapshot={snapshots.find(s => s.network === breakdownDialog.network) || null}
        />
      )}
    </div>
  );
}

