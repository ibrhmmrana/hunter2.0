import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SchedulerPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Scheduler</h1>
        <p className="text-muted-foreground">
          Schedule and manage your social media posts
        </p>
      </div>

      <Card className="rounded-2xl shadow-soft">
        <CardHeader>
          <CardTitle>Content Scheduler</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Content scheduling features will be available here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

