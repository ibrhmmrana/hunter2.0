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
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import CheckRounded from "@mui/icons-material/CheckRounded";
import OnboardingShell from "@/src/components/OnboardingShell";

const plans = [
  {
    id: "starter",
    name: "Starter",
    price: 29,
    features: [
      "Basic analytics dashboard",
      "Competitor tracking (up to 5)",
      "Monthly reports",
      "Email support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 49,
    features: [
      "Advanced analytics dashboard",
      "Unlimited competitor tracking",
      "Weekly reports",
      "AI-powered insights",
      "Priority support",
    ],
    popular: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 99,
    features: [
      "Everything in Pro",
      "Custom integrations",
      "Dedicated account manager",
      "White-label reports",
      "API access",
    ],
  },
];

export default function PaywallPage() {
  const router = useRouter();

  const handleSelectPlan = (planId: string) => {
    document.cookie = `plan_selected=true; path=/; max-age=31536000`;
    router.push("/");
  };

  const handleContinueFree = () => {
    document.cookie = `plan_selected=true; path=/; max-age=31536000`;
    router.push("/");
  };

  return (
    <OnboardingShell maxWidth="lg">
      <Card>
        <CardHeader sx={{ textAlign: "center" }}>
          <Typography variant="h4" sx={{ mb: 1, fontWeight: 600 }}>
            Premium business growth at the cost of lunch with a friend
          </Typography>
        </CardHeader>
        <CardContent>
          <Stack spacing={4}>
            <Grid container spacing={3}>
              {plans.map((plan) => (
                <Grid item xs={12} md={4} key={plan.id}>
                  <Card
                    variant="outlined"
                    sx={{
                      height: "100%",
                      borderRadius: 3,
                      border: plan.popular ? 2 : 1,
                      borderColor: plan.popular ? "primary.main" : "outline.variant",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <CardHeader>
                      <Stack spacing={2}>
                        {plan.popular && (
                          <Chip label="Most Popular" color="primary" size="small" sx={{ width: "fit-content" }} />
                        )}
                        <Typography variant="h6" fontWeight={600}>
                          {plan.name}
                        </Typography>
                        <Box>
                          <Typography component="span" variant="h4" fontWeight={700}>
                            ${plan.price}
                          </Typography>
                          <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
                            /month
                          </Typography>
                        </Box>
                      </Stack>
                    </CardHeader>
                    <CardContent sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
                      <Stack spacing={2} sx={{ flex: 1 }}>
                        <List dense sx={{ py: 0 }}>
                          {plan.features.map((feature, index) => (
                            <ListItem key={index} sx={{ py: 0.5, px: 0 }}>
                              <ListItemIcon sx={{ minWidth: 32 }}>
                                <CheckRounded fontSize="small" color="primary" />
                              </ListItemIcon>
                              <ListItemText
                                primary={feature}
                                primaryTypographyProps={{ variant: "body2" }}
                              />
                            </ListItem>
                          ))}
                        </List>
                        <Button
                          fullWidth
                          variant={plan.popular ? "contained" : "outlined"}
                          onClick={() => handleSelectPlan(plan.id)}
                          sx={{ borderRadius: 3, mt: "auto" }}
                        >
                          Choose {plan.name}
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            <Box sx={{ textAlign: "center", pt: 2 }}>
              <Button
                onClick={handleContinueFree}
                variant="text"
                sx={{ textDecoration: "underline" }}
              >
                Continue on free plan for now
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </OnboardingShell>
  );
}
