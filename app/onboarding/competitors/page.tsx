"use client";

import { useRouter } from "next/navigation";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Button,
  Stack,
  Chip,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";
import OnboardingShell from "@/src/components/OnboardingShell";

const competitors = [
  {
    name: "Competitor A",
    score: 85,
    reasons: [
      "Higher Google Business Profile rating (4.8 vs 4.5)",
      "More frequent social media posts (daily vs weekly)",
      "Better response rate to reviews",
    ],
  },
  {
    name: "Competitor B",
    score: 78,
    reasons: [
      "More Google reviews (450 vs 320)",
      "Active on TikTok with trending content",
      "Faster response time to customer inquiries",
    ],
  },
  {
    name: "Competitor C",
    score: 72,
    reasons: [
      "Strong local SEO presence",
      "Consistent branding across platforms",
      "Engaging Instagram stories and reels",
    ],
  },
];

export default function CompetitorsPage() {
  const router = useRouter();

  return (
    <OnboardingShell maxWidth="md">
      <Card>
        <CardHeader>
          <Typography variant="h5" fontWeight={600}>
            Your Competitors
          </Typography>
        </CardHeader>
        <CardContent>
          <Stack spacing={3}>
            {competitors.map((competitor, index) => (
              <Card key={index} variant="outlined" sx={{ borderRadius: 3 }}>
                <CardContent>
                  <Stack spacing={2}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Typography variant="h6" fontWeight={600}>
                        {competitor.name}
                      </Typography>
                      <Chip
                        label={`Score: ${competitor.score}/100`}
                        color={competitor.score >= 80 ? "primary" : "default"}
                        size="small"
                      />
                    </Box>
                    <Box>
                      <Typography variant="body2" fontWeight={500} color="text.secondary" sx={{ mb: 1 }}>
                        Why they&apos;re ahead:
                      </Typography>
                      <List dense sx={{ py: 0 }}>
                        {competitor.reasons.map((reason, reasonIndex) => (
                          <ListItem key={reasonIndex} sx={{ py: 0.5, px: 0 }}>
                            <ListItemText
                              primary={reason}
                              primaryTypographyProps={{ variant: "body2" }}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            ))}

            <Box sx={{ display: "flex", justifyContent: "flex-end", pt: 2 }}>
              <Button variant="contained" onClick={() => router.push("/onboarding/paywall")}>
                Next
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </OnboardingShell>
  );
}
