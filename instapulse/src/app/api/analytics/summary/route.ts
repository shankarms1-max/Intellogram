import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import { getWorkspaceSummary, getTopAccountsByEngagement, getMarketShare } from "@/services/metricsService";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; name?: string | null };
  const workspace = await getOrCreateDefaultWorkspace(user.id, user.name);

  const url = new URL(req.url);
  const days = parseInt(url.searchParams.get("days") || "30", 10);

  const [summary, topAccounts, marketShare] = await Promise.all([
    getWorkspaceSummary(workspace.id, days),
    getTopAccountsByEngagement(workspace.id, days),
    getMarketShare(workspace.id, days),
  ]);

  return NextResponse.json({ summary, topAccounts, marketShare });
}
