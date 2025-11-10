import { Sidebar } from "@/components/Sidebar";
import { DashboardContentLoader } from "@/components/DashboardContentLoader";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="ml-64 p-6">
        <DashboardContentLoader>
          {children}
        </DashboardContentLoader>
      </main>
    </div>
  );
}





