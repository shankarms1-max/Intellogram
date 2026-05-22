import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { DemoBanner } from "@/components/dashboard/DemoBanner";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");

  const user = session.user as { id: string; name?: string | null };
  const workspace = await getOrCreateDefaultWorkspace(user.id, user.name);
  const isDemoMode = process.env.DEMO_MODE === "true";

  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <Header workspaceName={workspace.name} />
        <main className="flex-1 p-4 md:p-6">
          {isDemoMode && <DemoBanner />}
          {children}
        </main>
      </div>
    </div>
  );
}
