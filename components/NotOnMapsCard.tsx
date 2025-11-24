"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  Button,
  Typography,
  Box,
  Stack,
  Avatar,
} from "@mui/material";
import LocationOnRounded from "@mui/icons-material/LocationOnRounded";

interface NotOnMapsCardProps {
  onBack?: () => void;
}

export function NotOnMapsCard({ onBack }: NotOnMapsCardProps) {
  return (
    <Card sx={{ borderRadius: 3 }}>
      <CardHeader>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar sx={{ bgcolor: "surface.variant" }}>
            <LocationOnRounded sx={{ color: "text.secondary" }} />
          </Avatar>
          <Typography variant="h5" fontWeight={600}>
            Not on Google Maps
          </Typography>
        </Stack>
      </CardHeader>
      <CardContent>
        <Stack spacing={3}>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
          You&apos;re invisible to &quot;near me&quot; searches. When customers search for businesses
          like yours nearby, your business won&apos;t appear in the results.
          </Typography>

          <Stack spacing={1.5} sx={{ pt: 2 }}>
            <Button
              component={Link}
              href="/onboarding/verify"
              variant="contained"
              fullWidth
              size="large"
              sx={{
                borderRadius: 3,
                py: 1.5,
                fontSize: "1rem",
                fontWeight: 600,
              }}
            >
              Create & Verify My Profile
            </Button>

          {onBack && (
            <Button
              onClick={onBack}
                variant="outlined"
                fullWidth
                sx={{
                  borderRadius: 3,
                  py: 1.5,
                }}
            >
              Go back to search
            </Button>
          )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
