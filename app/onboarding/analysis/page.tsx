"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardStat } from "@/components/CardStat";

export default function AnalysisPage() {
  const router = useRouter();

  return (
    <div>
      <CardHeader>
        <CardTitle className="text-2xl">Your Business Insights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        <div>
          <h3 className="text-lg font-semibold mb-4">Google Business Profile</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <CardStat
              title="Profile Views"
              value="1,234"
              trend="up"
              trendValue="+12%"
            />
            <CardStat
              title="Calls"
              value="89"
              trend="up"
              trendValue="+5%"
            />
            <CardStat
              title="Direction Requests"
              value="456"
              trend="down"
              trendValue="-3%"
            />
            <CardStat
              title="Website Clicks"
              value="678"
              trend="up"
              trendValue="+8%"
            />
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">Social Media</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <CardStat
              title="Instagram Followers"
              value="5.2K"
              trend="up"
              trendValue="+15%"
            />
            <CardStat
              title="TikTok Views"
              value="12.5K"
              trend="up"
              trendValue="+22%"
            />
            <CardStat
              title="Facebook Engagement"
              value="234"
              trend="up"
              trendValue="+7%"
            />
            <CardStat
              title="Total Reach"
              value="18.9K"
              trend="up"
              trendValue="+18%"
            />
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <Button variant="outline" onClick={() => router.back()}>
            Back
          </Button>
          <Button onClick={() => router.push("/onboarding/competitors")}>
            Next
          </Button>
        </div>
      </CardContent>
    </div>
  );
}






