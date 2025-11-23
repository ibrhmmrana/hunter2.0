"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
    <div>
      <CardHeader>
        <CardTitle className="text-2xl">Your Competitors</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {competitors.map((competitor, index) => (
          <Card key={index} className="rounded-2xl shadow-soft">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">{competitor.name}</h3>
                <Badge
                  variant={competitor.score >= 80 ? "default" : "secondary"}
                  className="text-sm"
                >
                  Score: {competitor.score}/100
                </Badge>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  Why they're ahead:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-foreground">
                  {competitor.reasons.map((reason, reasonIndex) => (
                    <li key={reasonIndex}>{reason}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ))}

        <div className="flex justify-end pt-4">
          <Button onClick={() => router.push("/onboarding/paywall")}>
            Next
          </Button>
        </div>
      </CardContent>
    </div>
  );
}








