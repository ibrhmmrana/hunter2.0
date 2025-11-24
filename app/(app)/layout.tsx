import MaterialShell from "@/src/components/MaterialShell";
import { DashboardContentLoader } from "@/components/DashboardContentLoader";
import { GlobalAlertNotifications } from "@/components/alerts/GlobalAlertNotifications";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MaterialShell>
        <DashboardContentLoader>
          {children}
        </DashboardContentLoader>
      <GlobalAlertNotifications />
    </MaterialShell>
  );
}

