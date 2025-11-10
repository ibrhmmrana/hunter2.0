import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AlertsList } from "@/components/alerts/AlertsList";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-up");
  }

  // Fetch alerts for the user
  const { data: alerts, error: alertsError } = await supabase
    .from("alerts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (alertsError) {
    console.error("[alerts] Error fetching alerts:", alertsError);
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Alerts</h1>
        <p className="text-muted-foreground">
          Stay updated on your watchlisted competitors' activity.
        </p>
      </div>

      {/* Alerts List */}
      <AlertsList initialAlerts={alerts || []} />
    </div>
  );
}
