import MaterialShell from "@/src/components/MaterialShell";
import { DashboardContentLoader } from "@/components/DashboardContentLoader";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MaterialShell>
      <DashboardContentLoader>
        {children}
      </DashboardContentLoader>
    </MaterialShell>
  );
}





