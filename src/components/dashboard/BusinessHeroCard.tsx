"use client";

import { useState, useCallback, useImperativeHandle, forwardRef } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardMedia,
  Box,
  Typography,
  Stack,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  useMediaQuery,
  useTheme,
  CircularProgress,
} from "@mui/material";
import StarRounded from "@mui/icons-material/StarRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import { formatReviewCount } from "@/lib/format";
import { BusinessSearchBox } from "@/components/BusinessSearchBox";
import { NotOnMapsCard } from "@/components/NotOnMapsCard";
import { LoadingSpinner } from "@/src/components/LoadingSpinner";
import { BusinessPreviewM3 } from "@/src/components/dashboard/BusinessPreviewM3";
import type { ConfirmBusinessData } from "@/app/api/places/confirm/route";

interface BusinessHeroCardProps {
  business: {
    place_id: string;
    name: string;
    address?: string | null;
    city?: string | null;
    image_url?: string | null;
    google_maps_url?: string | null;
    rating?: number | null;
    reviews_count?: number | null;
    categories?: string[] | null;
    socialMediaSection?: React.ReactNode;
  };
  onBusinessChange?: () => void;
}

const BusinessHeroCard = forwardRef<{ openChangeDialog: () => void }, BusinessHeroCardProps>(
  ({ business, onBusinessChange }, ref) => {
    const router = useRouter();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));
    const [showChangeDialog, setShowChangeDialog] = useState(false);

    // Expose function to open dialog from parent
    useImperativeHandle(ref, () => ({
      openChangeDialog: () => setShowChangeDialog(true),
    }));
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [confirmData, setConfirmData] = useState<ConfirmBusinessData | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const displayAddress = [business.address, business.city].filter(Boolean).join(", ");
  const rating = business.rating ?? null;
  const reviewCount = business.reviews_count ?? null;

  const handlePlaceSelect = useCallback(async (placeId: string) => {
    setSelectedPlaceId(placeId);
    setIsLoadingDetails(true);
    setError(null);
    setConfirmData(null);

    try {
      const response = await fetch(`/api/places/confirm?placeId=${encodeURIComponent(placeId)}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          const errorData = await response.json();
          if (errorData.error === "NOT_FOUND") {
            setError("NOT_FOUND");
            return;
          }
        }
        throw new Error("Failed to load business details");
      }

      const data = await response.json();
      setConfirmData(data);
    } catch (err: any) {
      console.error("Failed to fetch place details:", err);
      if (err.message === "Place not found" || err.message.includes("NOT_FOUND")) {
        setError("NOT_FOUND");
      } else {
        setError(err.message || "Failed to load business details");
      }
    } finally {
      setIsLoadingDetails(false);
    }
  }, []);

  const handleReject = useCallback(() => {
    setSelectedPlaceId(null);
    setConfirmData(null);
    setError(null);
  }, []);

  const handleConfirmChange = useCallback(async () => {
    if (!selectedPlaceId || !confirmData) return;
    
    setIsUpdating(true);
    setError(null);
    
    try {
      // Build businessSnapshot from confirmData
      const businessSnapshot = {
        place_id: selectedPlaceId,
        name: confirmData.name || undefined,
        formatted_address: confirmData.address || undefined,
        lat: confirmData.location?.lat || undefined,
        lng: confirmData.location?.lng || undefined,
        image_url: confirmData.photos?.[0] ? `/api/places/photo?ref=${encodeURIComponent(confirmData.photos[0].ref)}&w=800` : undefined,
        google_maps_url: confirmData.google_maps_url || undefined,
        primary_category: confirmData.categories?.[0] || undefined,
        rating: confirmData.rating || undefined,
        reviews_count: confirmData.reviews_count || undefined,
        categories: confirmData.categories || undefined,
      };

      // Call kickoff to ensure business is saved with owner_id
      const kickoffResponse = await fetch('/api/onboard/kickoff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessPlaceId: selectedPlaceId,
          businessSnapshot,
        }),
      });

      const kickoffData = await kickoffResponse.json();

      if (!kickoffResponse.ok || !kickoffData.ok) {
        console.error('[ChangeBusiness] Kickoff failed:', kickoffData);
        setError(kickoffData?.error || 'We couldn\'t update your business. Please try again.');
        setIsUpdating(false);
        return;
      }

      // Update default business
      const changeResponse = await fetch('/api/dashboard/change-business', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          place_id: selectedPlaceId,
        }),
      });

      const changeData = await changeResponse.json();

      if (!changeResponse.ok || !changeData.ok) {
        console.error('[ChangeBusiness] Change failed:', changeData);
        setError(changeData?.error || 'We couldn\'t update your default business. Please try again.');
        setIsUpdating(false);
        return;
      }

      // Close dialog and refresh page
      setShowChangeDialog(false);
      setSelectedPlaceId(null);
      setConfirmData(null);
      router.refresh();
      onBusinessChange?.();
    } catch (error: any) {
      console.error('[ChangeBusiness] Error updating business:', error);
      setError(error?.message || 'We couldn\'t update your business. Please try again.');
      setIsUpdating(false);
    }
  }, [selectedPlaceId, confirmData, router, onBusinessChange]);

  return (
    <Card
      sx={{
        borderRadius: 2,
        backgroundColor: (theme) => theme.palette.surfaceContainer?.main || "#FFFFFF",
        boxShadow: "0px 1px 2px rgba(0,0,0,0.08)",
        overflow: "hidden",
        height: { 
          xs: "calc(100vh - 200px)", 
          sm: "calc(100vh - 180px)",
          md: "calc(100vh - 160px)",
          lg: "calc(100vh - 140px)",
          xl: "calc(100vh - 120px)",
        },
        maxHeight: { 
          xs: "calc(100vh - 200px)", 
          sm: "calc(100vh - 180px)",
          md: "calc(100vh - 160px)",
          lg: "calc(100vh - 140px)",
          xl: "calc(100vh - 120px)",
        },
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1.5fr" },
          gap: 0,
          height: "100%",
          overflow: "hidden",
        }}
      >
        {/* Image Area - Left Side */}
        <Box 
          sx={{ 
            position: "relative", 
            width: "100%", 
            height: "100%",
            minHeight: { xs: "200px", sm: "240px", md: "280px", lg: "320px", xl: "360px" },
            maxHeight: "100%",
          }}
        >
          <CardMedia
            component="img"
            src={business.image_url || undefined}
            alt={business.name}
            sx={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              backgroundColor: (theme) => theme.palette.surfaceContainerLow?.main || "#E9EEE4",
              backgroundImage: business.image_url
                ? undefined
                : "linear-gradient(135deg, #E9EEE4 0%, #C7CEC3 100%)",
            }}
          />
        </Box>

        {/* Content Section - Right Side */}
        <CardContent 
          sx={{ 
            p: { 
              xs: 2, 
              sm: 2.5, 
              md: 3, 
              lg: 3.5, 
              xl: 4 
            }, 
            display: "flex", 
            flexDirection: "column",
            height: "100%",
            overflowY: "auto",
            overflowX: "hidden",
            "&::-webkit-scrollbar": {
              width: "8px",
            },
            "&::-webkit-scrollbar-track": {
              backgroundColor: (theme) => theme.palette.surfaceContainerLow?.main || "#E9EEE4",
              borderRadius: "4px",
            },
            "&::-webkit-scrollbar-thumb": {
              backgroundColor: (theme) => theme.palette.outlineVariant?.main || "#DDE4D8",
              borderRadius: "4px",
              "&:hover": {
                backgroundColor: (theme) => theme.palette.outline?.main || "#C7CEC3",
              },
            },
          }}
        >
          <Stack spacing={{ xs: 1.5, sm: 2, md: 2.5, lg: 3 }}>
            {/* Title */}
            <Box sx={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
              <Typography 
                variant="headlineLarge" 
                sx={{ 
                  mb: { xs: 0.25, md: 0.5 }, 
                  fontWeight: 400,
                  fontSize: { 
                    xs: "1.5rem", 
                    sm: "1.75rem", 
                    md: "2rem", 
                    lg: "2.25rem", 
                    xl: "2.5rem" 
                  },
                  lineHeight: { xs: 1.3, md: 1.2 },
                }}
              >
                {business.name}
              </Typography>
              
              {/* Address - styled as subtitle */}
              {displayAddress && (
                <Typography
                  variant="bodyMedium"
                  sx={{
                    color: (theme) => theme.palette.onSurfaceVariant?.main || "#444A41",
                    fontWeight: 400,
                    fontSize: { 
                      xs: "0.875rem", 
                      sm: "0.9375rem", 
                      md: "1rem", 
                      lg: "1.0625rem", 
                      xl: "1.125rem" 
                    },
                  }}
                >
                  {displayAddress}
                </Typography>
              )}

              {/* Rating and Reviews */}
              {rating != null && (
                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: { xs: 1, md: 1.5 } }}>
                  <StarRounded sx={{ fontSize: { xs: 18, sm: 20, md: 22, lg: 24, xl: 26 }, color: "#F5B400" }} />
                  <Typography variant="bodyLarge" sx={{ fontWeight: 500, fontSize: { xs: "0.9375rem", sm: "1rem", md: "1.0625rem", lg: "1.125rem", xl: "1.25rem" } }}>
                    {rating.toFixed(1)}
                  </Typography>
                  {reviewCount != null && (
                    <Typography
                      variant="bodyMedium"
                      sx={{
                        color: (theme) => theme.palette.onSurfaceVariant?.main || "#444A41",
                        ml: 0.5,
                        fontSize: { xs: "0.8125rem", sm: "0.875rem", md: "0.9375rem", lg: "1rem", xl: "1.0625rem" },
                      }}
                    >
                      ({formatReviewCount(reviewCount)})
                    </Typography>
                  )}
                </Stack>
              )}
            </Box>

            {/* Category Tags - Styled as tonal buttons */}
            {business.categories && business.categories.length > 0 && (
              <Stack direction="row" spacing={{ xs: 1, md: 1.5, lg: 2 }} flexWrap="wrap" sx={{ flexShrink: 0 }}>
                {business.categories.slice(0, 3).map((c, idx) => (
                  <Button
                    key={idx}
                    variant="text"
                    disabled
                    sx={{
                      borderRadius: 0.5,
                      px: { xs: 1.5, sm: 2, md: 2.5, lg: 3 },
                      py: { xs: 0.5, sm: 0.625, md: 0.75, lg: 0.875 },
                      backgroundColor: (theme) => theme.palette.surfaceContainerHigh?.main || "#F6FAF0",
                      color: (theme) => theme.palette.onSurface?.main || "#1B1C19",
                      textTransform: "none",
                      fontWeight: 500,
                      fontSize: { xs: "0.75rem", sm: "0.8125rem", md: "0.875rem", lg: "0.9375rem", xl: "1rem" },
                      border: "1px solid",
                      borderColor: (theme) => theme.palette.outlineVariant?.main || "#DDE4D8",
                      boxShadow: "0px 1px 2px rgba(0,0,0,0.08)",
                      "&:hover": {
                        backgroundColor: (theme) => theme.palette.surfaceContainerHigh?.main || "#F6FAF0",
                        boxShadow: "0px 1px 2px rgba(0,0,0,0.08)",
                      },
                      "&.Mui-disabled": {
                        color: (theme) => theme.palette.onSurface?.main || "#1B1C19",
                      },
                    }}
                  >
                    {c.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                  </Button>
                ))}
                {business.categories.length > 3 && (
                  <Button
                    variant="text"
                    disabled
                    sx={{
                      borderRadius: 0.5,
                      px: { xs: 1.5, sm: 2, md: 2.5, lg: 3 },
                      py: { xs: 0.5, sm: 0.625, md: 0.75, lg: 0.875 },
                      backgroundColor: (theme) => theme.palette.surfaceContainerHigh?.main || "#F6FAF0",
                      color: (theme) => theme.palette.onSurface?.main || "#1B1C19",
                      textTransform: "none",
                      fontWeight: 500,
                      fontSize: { xs: "0.75rem", sm: "0.8125rem", md: "0.875rem", lg: "0.9375rem", xl: "1rem" },
                      border: "1px solid",
                      borderColor: (theme) => theme.palette.outlineVariant?.main || "#DDE4D8",
                      boxShadow: "0px 1px 2px rgba(0,0,0,0.08)",
                      "&:hover": {
                        backgroundColor: (theme) => theme.palette.surfaceContainerHigh?.main || "#F6FAF0",
                        boxShadow: "0px 1px 2px rgba(0,0,0,0.08)",
                      },
                      "&.Mui-disabled": {
                        color: (theme) => theme.palette.onSurface?.main || "#1B1C19",
                      },
                    }}
                  >
                    +{business.categories.length - 3}
                  </Button>
                )}
              </Stack>
            )}

            {/* Social Media Grid Section */}
            {business.socialMediaSection && (
              <Box sx={{ display: "flex", flexDirection: "column" }}>
                {business.socialMediaSection}
              </Box>
            )}
          </Stack>
        </CardContent>
      </Box>

      {/* Change Business Dialog - M3 Style */}
      <Dialog
        open={showChangeDialog}
        onClose={() => {
          if (!isUpdating) {
            setShowChangeDialog(false);
            handleReject();
          }
        }}
        maxWidth="lg"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            borderRadius: isMobile ? 0 : 2,
            backgroundColor: (theme) => theme.palette.surfaceContainer?.main || "#FFFFFF",
            boxShadow: "0px 1px 2px rgba(0,0,0,0.08)",
            maxHeight: isMobile ? "100vh" : "90vh",
          },
        }}
      >
        {/* Dialog Title with Close Button */}
        <DialogTitle
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            pb: 1,
            px: 3,
            pt: 3,
          }}
        >
          <Typography variant="headlineLarge" sx={{ fontWeight: 400 }}>
            {confirmData ? "Confirm Business" : "Find your business"}
          </Typography>
          <IconButton
            onClick={() => {
              if (!isUpdating) {
                setShowChangeDialog(false);
                handleReject();
              }
            }}
            disabled={isUpdating}
            size="small"
            sx={{
              color: (theme) => theme.palette.onSurface?.main || "#1B1C19",
              "&:hover": {
                backgroundColor: (theme) => theme.palette.action.hover,
              },
            }}
          >
            <CloseRounded />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ px: 3, py: 2 }}>
          {/* Search Section */}
          {!confirmData && !isLoadingDetails && error !== "NOT_FOUND" && (
            <Box>
              <Typography
                variant="bodyMedium"
                sx={{
                  color: (theme) => theme.palette.onSurfaceVariant?.main || "#444A41",
                  mb: 3,
                }}
              >
                Start typing your business name. We&apos;ll search Google.
              </Typography>
              <BusinessSearchBox onSelect={handlePlaceSelect} />
            </Box>
          )}

          {/* Loading State */}
          {isLoadingDetails && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <LoadingSpinner message="Loading business details..." />
            </Box>
          )}

          {/* Error State - Not Found */}
          {error === "NOT_FOUND" && (
            <Box>
              <NotOnMapsCard onBack={handleReject} />
            </Box>
          )}

          {/* Business Preview Section - M3 Style */}
          {confirmData && selectedPlaceId && !isLoadingDetails && !error && (
            <BusinessPreviewM3
              data={confirmData}
              placeId={selectedPlaceId}
            />
          )}
        </DialogContent>

        {/* Dialog Actions - M3 Style */}
        {confirmData && selectedPlaceId && !isLoadingDetails && !error && (
          <DialogActions
            sx={{
              justifyContent: "flex-end",
              gap: 1.5,
              px: 3,
              pb: 3,
              pt: 2,
            }}
          >
            <Button
              onClick={handleReject}
              variant="outlined"
              disabled={isUpdating}
              sx={{
                borderRadius: 999,
                textTransform: "none",
                fontWeight: 500,
                fontSize: "14px",
                backgroundColor: (theme) => theme.palette.surfaceContainer?.main || "#FFFFFF",
                color: (theme) => theme.palette.onSurface?.main || "#1B1C19",
                borderColor: (theme) => theme.palette.outlineVariant?.main || "#DDE4D8",
                borderWidth: 1,
                "&:hover": {
                  backgroundColor: (theme) => theme.palette.surfaceContainer?.main || "#FFFFFF",
                  borderColor: (theme) => theme.palette.outlineVariant?.main || "#DDE4D8",
                },
                "&.Mui-disabled": {
                  backgroundColor: (theme) => theme.palette.surfaceContainer?.main || "#FFFFFF",
                  borderColor: (theme) => theme.palette.outlineVariant?.main || "#DDE4D8",
                  color: (theme) => theme.palette.onSurface?.main || "#1B1C19",
                  opacity: 0.38,
                },
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmChange}
              variant="contained"
              disabled={isUpdating}
              sx={{
                borderRadius: 999,
                textTransform: "none",
                fontWeight: 500,
                fontSize: "14px",
                backgroundColor: (theme) => theme.palette.primary.main || "#2E7D32",
                color: (theme) => theme.palette.onPrimary?.main || "#FFFFFF",
                boxShadow: "none",
                "&:hover": {
                  backgroundColor: (theme) => theme.palette.primary.dark || "#1B5E20",
                  boxShadow: "none",
                },
                "&.Mui-disabled": {
                  backgroundColor: (theme) => theme.palette.primary.main || "#2E7D32",
                  color: (theme) => theme.palette.onPrimary?.main || "#FFFFFF",
                  opacity: 0.38,
                },
              }}
            >
              {isUpdating ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <CircularProgress size={16} color="inherit" />
                  <span>Updating...</span>
                </Stack>
              ) : (
                "Change Business"
              )}
            </Button>
          </DialogActions>
        )}
      </Dialog>
    </Card>
  );
});

BusinessHeroCard.displayName = "BusinessHeroCard";

export default BusinessHeroCard;

