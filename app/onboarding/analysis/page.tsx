"use client";

import { useRouter } from "next/navigation";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Button,
  Grid,
  Stack,
} from "@mui/material";
import { CardStat } from "@/components/CardStat";
import OnboardingShell from "@/src/components/OnboardingShell";

export default function AnalysisPage() {
  const router = useRouter();

  return (
    <OnboardingShell maxWidth="lg">
      <Card>
        <CardHeader>
          <Typography variant="h5" fontWeight={600}>
            Your Business Insights
          </Typography>
        </CardHeader>
        <CardContent>
          <Stack spacing={4}>
            <Box>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Google Business Profile
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <CardStat
                    title="Profile Views"
                    value="1,234"
                    trend="up"
                    trendValue="+12%"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <CardStat
                    title="Calls"
                    value="89"
                    trend="up"
                    trendValue="+5%"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <CardStat
                    title="Direction Requests"
                    value="456"
                    trend="down"
                    trendValue="-3%"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <CardStat
                    title="Website Clicks"
                    value="678"
                    trend="up"
                    trendValue="+8%"
                  />
                </Grid>
              </Grid>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Social Media
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <CardStat
                    title="Instagram Followers"
                    value="5.2K"
                    trend="up"
                    trendValue="+15%"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <CardStat
                    title="TikTok Views"
                    value="12.5K"
                    trend="up"
                    trendValue="+22%"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <CardStat
                    title="Facebook Engagement"
                    value="234"
                    trend="up"
                    trendValue="+7%"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <CardStat
                    title="Total Reach"
                    value="18.9K"
                    trend="up"
                    trendValue="+18%"
                  />
                </Grid>
              </Grid>
            </Box>

            <Stack direction="row" spacing={2} sx={{ pt: 2 }}>
              <Button variant="outlined" onClick={() => router.back()}>
                Back
              </Button>
              <Button variant="contained" onClick={() => router.push("/onboarding/competitors")}>
                Next
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </OnboardingShell>
  );
}
