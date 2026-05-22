import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import { syncWorkspace } from "@/services/accountSyncService";
import { isWorkspaceRateLimited } from "@/services/instagramApiClient";

export async function POST(_req: Request) {
  if (process.env.DEMO_MODE === "true") {
    return NextResponse.json({ error: "Sync is disabled in demo mode" }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; name?: string | null };
  const workspace = await getOrCreateDefaultWorkspace(user.id, user.name);

  const rateLimited = await isWorkspaceRateLimited(workspace.id);
  if (rateLimited) {
    return NextResponse.json(
      { error: "Meta API rate limit exceeded (≥90% quota). Sync paused until quota resets." },
      { status: 429 }
    );
  }

  const result = await syncWorkspace(workspace.id);
  return NextResponse.json(result);
}
