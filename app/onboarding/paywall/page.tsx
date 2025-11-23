"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
    <div>
      <CardHeader className="text-center">
        <CardTitle className="text-3xl mb-2">
          Premium business growth at the cost of lunch with a friend
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`rounded-2xl shadow-soft ${
                plan.popular ? "border-primary border-2" : ""
              }`}
            >
              <CardHeader>
                {plan.popular && (
                  <Badge className="w-fit mb-2">Most Popular</Badge>
                )}
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <div className="text-3xl font-bold">
                  ${plan.price}
                  <span className="text-base font-normal text-muted-foreground">
                    /month
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full rounded-2xl"
                  variant={plan.popular ? "default" : "outline"}
                  onClick={() => handleSelectPlan(plan.id)}
                >
                  Choose {plan.name}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center pt-4">
          <button
            onClick={handleContinueFree}
            className="text-sm text-muted-foreground hover:text-foreground underline"
          >
            Continue on free plan for now
          </button>
        </div>
      </CardContent>
    </div>
  );
}








