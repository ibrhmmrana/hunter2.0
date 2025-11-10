"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Instagram, Facebook, Loader2, Plus, X, RefreshCw, Edit2, Check, X as XIcon, Star } from "lucide-react";
import { useToast } from "@/components/Toast";

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

  // Poll for snapshots if we have profiles but no snapshots
  useEffect(() => {
    console.log('[SocialMediaSection] Polling effect triggered', {
      profilesCount: profiles.length,
      snapshotsCount: snapshots.length,
      profiles: profiles.map(p => ({ network: p.network, handle: p.handle })),
      snapshots: snapshots.map(s => ({ network: s.network })),
    });
    
    const networksToPoll = profiles
      .filter(p => !snapshots.find(s => s.network === p.network))
      .map(p => p.network) as ('instagram' | 'tiktok' | 'facebook')[];

    console.log('[SocialMediaSection] Networks to poll:', networksToPoll);

    if (networksToPoll.length === 0) {
      console.log('[SocialMediaSection] No networks to poll, clearing polling state');
      setPollingNetworks(new Set());
      setTimeoutNetworks(new Set());
      return;
    }

    console.log('[SocialMediaSection] Starting polling for:', networksToPoll);
    setPollingNetworks(new Set(networksToPoll));

    // Store handles for networks being polled
    setNetworkHandles(prev => {
      const updated = { ...prev };
      networksToPoll.forEach(network => {
        const profile = profiles.find(p => p.network === network);
        if (profile) {
          updated[network] = profile.handle;
        }
      });
      return updated;
    });

    let pollCount = 0;
    const maxPolls = 15; // 15 polls * 4 seconds = 60 seconds max
    const POLL_INTERVAL = 4000; // 4 seconds

    const pollInterval = setInterval(async () => {
      pollCount++;
      
      try {
        // Check for new snapshots for each network we're polling
        const newSnapshots: SocialSnapshot[] = [];
        for (const network of networksToPoll) {
          try {
            const response = await fetch(`/api/social/snapshots?businessId=${businessId}&network=${network}`);
            const result = await response.json();
            
            console.log(`[SocialMediaSection] Poll ${pollCount} for ${network}:`, {
              status: response.status,
              ok: response.ok,
              resultOk: result.ok,
              hasData: !!result.data,
              data: result.data ? {
                network: result.data.network,
                posts_total: result.data.posts_total,
                posts_last_30d: result.data.posts_last_30d,
                followers: result.data.followers,
              } : null,
            });
            
            if (response.ok && result.ok && result.data) {
              const snapshotData = {
                network: result.data.network,
                posts_total: result.data.posts_total,
                posts_last_30d: result.data.posts_last_30d,
                days_since_last_post: result.data.days_since_last_post,
                engagement_rate: result.data.engagement_rate,
                followers: result.data.followers,
                snapshot_ts: result.data.snapshot_ts,
              };
              newSnapshots.push(snapshotData);
              console.log(`[SocialMediaSection] ✅ Found snapshot for ${network}`, {
                posts_last_30d: snapshotData.posts_last_30d,
                days_since_last_post: snapshotData.days_since_last_post,
                days_since_last_post_type: typeof snapshotData.days_since_last_post,
                followers: snapshotData.followers,
              });
            } else if (response.ok && result.ok && !result.data) {
              console.log(`[SocialMediaSection] No snapshot yet for ${network} (poll ${pollCount}/${maxPolls})`);
            }
          } catch (err) {
            console.error(`[SocialMediaSection] Error polling ${network}:`, err);
          }
        }

        if (newSnapshots.length > 0) {
          setSnapshots(prev => {
            const updated = [...prev];
            newSnapshots.forEach(newSnap => {
              const idx = updated.findIndex(s => s.network === newSnap.network);
              if (idx >= 0) {
                updated[idx] = newSnap;
              } else {
                updated.push(newSnap);
              }
            });
            return updated;
          });
          // Stop polling for networks that now have snapshots
          setPollingNetworks(prev => {
            const updated = new Set(prev);
            newSnapshots.forEach(snap => updated.delete(snap.network));
            return updated;
          });
          setTimeoutNetworks(prev => {
            const updated = new Set(prev);
            newSnapshots.forEach(snap => updated.delete(snap.network));
            return updated;
          });
        } else if (pollCount >= maxPolls) {
          // Timeout reached - mark networks as timed out
          setTimeoutNetworks(prev => {
            const updated = new Set(prev);
            networksToPoll.forEach(network => {
              if (!snapshots.find(s => s.network === network)) {
                updated.add(network);
              }
            });
            return updated;
          });
          setPollingNetworks(new Set());
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error('[SocialMediaSection] Polling error:', error);
      }
    }, POLL_INTERVAL);

    // Stop polling after max time
    const timeout = setTimeout(() => {
      clearInterval(pollInterval);
      const stillPolling = networksToPoll.filter(network => !snapshots.find(s => s.network === network));
      if (stillPolling.length > 0) {
        setTimeoutNetworks(prev => {
          const updated = new Set(prev);
          stillPolling.forEach(network => updated.add(network));
          return updated;
        });
      }
      setPollingNetworks(new Set());
    }, maxPolls * POLL_INTERVAL);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
    };
  }, [businessId, profiles, snapshots]);

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

      // Clear timeout state for this network if it was previously timed out
      setTimeoutNetworks(prev => {
        const updated = new Set(prev);
        updated.delete(network);
        return updated;
      });

      addToast(`${config.label} account added. Analysis in progress...`, 'success');
      setHandleValue('');
      setAddingNetwork(null);
    } catch (error: any) {
      console.error(`[SocialMediaSection] Failed to add ${network}:`, error);
      addToast(error.message || `Failed to add ${config.label} account`, 'error');
    } finally {
      setIsSubmitting(false);
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

      // Remove existing snapshot to trigger polling
      setSnapshots(prev => prev.filter(s => s.network !== network));
      setPollingNetworks(prev => new Set(prev).add(network));
      setTimeoutNetworks(prev => {
        const updated = new Set(prev);
        updated.delete(network);
        return updated;
      });

      addToast(`${config.label} refresh started. Fetching latest data...`, 'success');
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

      // Remove existing snapshot to trigger new analysis
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

  const [googleSnapshot, setGoogleSnapshot] = useState<GoogleReviewSnapshot | null>(googleReviewSnapshot || null);
  const [pollingGoogle, setPollingGoogle] = useState(false);
  const [googleTimeout, setGoogleTimeout] = useState(false);
  const hasTriggeredGoogleAnalysisRef = useRef(false);

  // Automatically trigger Google reviews analysis if business exists but no snapshot
  useEffect(() => {
    if (businessId && !googleSnapshot && !pollingGoogle && !googleTimeout && !hasTriggeredGoogleAnalysisRef.current) {
      hasTriggeredGoogleAnalysisRef.current = true;
      
      // Trigger analysis automatically
      const triggerAnalysis = async () => {
        try {
          console.log('[SocialMediaSection] Auto-triggering Google reviews analysis for', businessId);
          
          const response = await fetch('/api/google/reviews/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              businessId,
              placeId: businessId,
            }),
          });

          if (!response.ok) {
            console.error('[SocialMediaSection] Failed to trigger Google reviews analysis:', response.status);
            hasTriggeredGoogleAnalysisRef.current = false; // Allow retry
            return;
          }

          console.log('[SocialMediaSection] Google reviews analysis triggered successfully');
          
          // Start polling for results
      setPollingGoogle(true);
      setGoogleTimeout(false);
      let pollCount = 0;
      const maxPolls = 15; // 60 seconds max (15 * 4s)
      const MAX_POLL_TIME = 60000; // 60 seconds

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
            return;
          }
        } catch (err) {
          console.warn('[SocialMediaSection] Error polling Google reviews:', err);
        }

        if (pollCount < maxPolls) {
          setTimeout(poll, 4000); // Poll every 4 seconds
        } else {
          setPollingGoogle(false);
          setGoogleTimeout(true);
        }
      };

          // Start polling after a short delay to allow analysis to start
          setTimeout(poll, 4000);
        } catch (error: any) {
          console.error('[SocialMediaSection] Error triggering Google reviews analysis:', error);
          hasTriggeredGoogleAnalysisRef.current = false; // Allow retry
        }
      };

      triggerAnalysis();
    }
  }, [businessId, googleSnapshot, pollingGoogle, googleTimeout]);

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

      addToast({
        type: 'success',
        message: 'Google reviews analysis started. This may take a moment.',
      });

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
            addToast({
              type: 'success',
              message: 'Google reviews data updated',
            });
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
      addToast({
        type: 'error',
        message: error.message || 'Failed to refresh Google reviews',
      });
      setPollingGoogle(false);
    }
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-4">
        {(['instagram', 'tiktok', 'facebook'] as const).map((network) => {
          const config = NETWORK_CONFIG[network];
          const snapshot = snapshots.find(s => s.network === network);
          const profile = profiles.find(p => p.network === network);
          const Icon = config.icon;

          return (
            <Card key={network} className="rounded-2xl shadow-lg">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    {Icon ? <Icon className="w-4 h-4" /> : (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                      </svg>
                    )}
                    {config.label}
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    {profile && snapshot && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRefreshAccount(network)}
                        disabled={refreshingNetworks.has(network) || isSubmitting}
                        className="h-6 w-6 p-0"
                        title="Refresh data"
                      >
                        {refreshingNetworks.has(network) ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3" />
                        )}
                      </Button>
                    )}
                    {profile && !editingNetwork && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingNetwork(network);
                          setEditHandleValues(prev => ({ ...prev, [network]: profile.handle }));
                        }}
                        disabled={isSubmitting}
                        className="h-6 w-6 p-0"
                        title="Edit username"
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                    )}
                    {!profile && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAddingNetwork(network)}
                        className="h-6 w-6 p-0"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
                {profile && !editingNetwork && (
                  <div className="text-xs text-gray-500 mt-1">
                    @{profile.handle}
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {editingNetwork === network ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{config.prefix}</span>
                      <Input
                        type="text"
                        placeholder={config.placeholder}
                        value={editHandleValues[network] || ''}
                        onChange={(e) => {
                          setEditHandleValues(prev => ({ ...prev, [network]: e.target.value }));
                        }}
                        className="flex-1 h-8 text-sm"
                        autoFocus
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleUpdateAccount(network)}
                        disabled={isSubmitting || !editHandleValues[network]?.trim()}
                        className="h-7 text-xs"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            Updating...
                          </>
                        ) : (
                          <>
                            <Check className="w-3 h-3 mr-1" />
                            Save
                          </>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingNetwork(null);
                          setEditHandleValues(prev => ({ ...prev, [network]: '' }));
                        }}
                        disabled={isSubmitting}
                        className="h-7 text-xs"
                      >
                        <XIcon className="w-3 h-3 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : addingNetwork === network ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{config.prefix}</span>
                      <Input
                        type="text"
                        placeholder={config.placeholder}
                        value={handleValue}
                        onChange={(e) => setHandleValue(e.target.value)}
                        className="flex-1 h-8 text-sm"
                        autoFocus
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleAddAccount(network)}
                        disabled={isSubmitting}
                        className="h-7 text-xs"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            Adding...
                          </>
                        ) : (
                          'Add'
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setAddingNetwork(null);
                          setHandleValue('');
                        }}
                        className="h-7 text-xs"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : profile ? (
                  snapshot ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Posts (30d):</span>
                        <span className="font-medium">{snapshot.posts_last_30d !== null ? snapshot.posts_last_30d : 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Engagement:</span>
                        <span className="font-medium">{formatEngagementRate(snapshot.engagement_rate)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Days since last:</span>
                        <span className="font-medium">
                          {snapshot.days_since_last_post !== null ? (
                            (() => {
                              const value = snapshot.days_since_last_post;
                              console.log(`[SocialMediaSection] Displaying days_since_last_post for ${network}:`, {
                                value,
                                type: typeof value,
                                raw: snapshot.days_since_last_post,
                              });
                              return value;
                            })()
                          ) : 'N/A'}
                        </span>
                      </div>
                      {snapshot.followers !== null && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Followers:</span>
                          <span className="font-medium">{formatNumber(snapshot.followers)}</span>
                        </div>
                      )}
                    </div>
                  ) : timeoutNetworks.has(network) ? (
                    <div className="space-y-3 text-sm">
                      <div className="text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="font-medium text-xs mb-1">Analysis timed out</p>
                        <p className="text-xs text-red-700">The analysis is taking longer than expected. You can try again with a different handle or check back later.</p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">{config.prefix}</span>
                          <Input
                            type="text"
                            placeholder={config.placeholder}
                            value={networkHandles[network] || ''}
                            onChange={(e) => {
                              setNetworkHandles(prev => ({ ...prev, [network]: e.target.value }));
                            }}
                            className="flex-1 h-8 text-xs"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              const handle = networkHandles[network] || profile.handle;
                              if (handle.trim()) {
                                setHandleValue(handle.trim());
                                handleAddAccount(network);
                              }
                            }}
                            disabled={isSubmitting || !networkHandles[network]?.trim()}
                            className="h-7 text-xs"
                          >
                            {isSubmitting ? (
                              <>
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                Retrying...
                              </>
                            ) : (
                              'Retry'
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              // Remove the profile to allow re-adding
                              setProfiles(prev => prev.filter(p => p.network !== network));
                              setTimeoutNetworks(prev => {
                                const updated = new Set(prev);
                                updated.delete(network);
                                return updated;
                              });
                              setNetworkHandles(prev => ({ ...prev, [network]: '' }));
                            }}
                            className="h-7 text-xs"
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                      {pollingNetworks.has(network) ? 'Analyzing...' : 'No data yet'}
                    </div>
                  )
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAddingNetwork(network)}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add {config.label}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}

        {/* Google Reviews Card */}
        <Card className="rounded-2xl shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                Google
              </CardTitle>
              {googleSnapshot && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefreshGoogle}
                  disabled={pollingGoogle}
                  className="h-6 w-6 p-0"
                  title="Refresh data"
                >
                  {pollingGoogle ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3" />
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {googleSnapshot ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Negative reviews:</span>
                  <span className="font-medium">{googleSnapshot.negative_reviews}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Positive reviews:</span>
                  <span className="font-medium">{googleSnapshot.positive_reviews}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Days since last:</span>
                  <span className="font-medium">
                    {googleSnapshot.days_since_last_review !== null ? googleSnapshot.days_since_last_review : 'N/A'}
                  </span>
                </div>
                {googleSnapshot.total_reviews !== null && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total reviews:</span>
                    <span className="font-medium">{formatNumber(googleSnapshot.total_reviews)}</span>
                  </div>
                )}
              </div>
            ) : googleTimeout ? (
              <div className="space-y-3 text-sm">
                <div className="text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="font-medium text-xs mb-1">Analysis timed out</p>
                  <p className="text-xs text-red-700">The analysis is taking longer than expected. You can try again or check back later.</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshGoogle}
                  className="w-full"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry Analysis
                </Button>
              </div>
            ) : pollingGoogle ? (
              <div className="text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                Analyzing...
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshGoogle}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Analyze Reviews
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

