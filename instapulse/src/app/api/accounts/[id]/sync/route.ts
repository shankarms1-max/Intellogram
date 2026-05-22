import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { syncOwnAccount } from "@/services/accountSyncService";
import { isWorkspaceRateLimited } from "@/services/instagramApiClient";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (process.env.DEMO_MODE === "true") {
    return NextResponse.json({ error: "Sync is disabled in demo mode" }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { id: string; name?: string | null };
  const workspace = await getOrCreateDefaultWorkspace(user.id, user.name);
  const { id } = await params;

  const account = await db.trackedAccount.findFirst({
    where: { id, workspaceId: workspace.id },
  });

  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // Only own accounts can be synced via API
  if (account.accountType !== "own") {
    return NextResponse.json(
      { error: "Only own accounts can be synced via API. Competitors require CSV import." },
      { status: 400 }
    );
  }

  const rateLimited = await isWorkspaceRateLimited(workspace.id);
  if (rateLimited) {
    return NextResponse.json(
      { error: "Meta API rate limit exceeded (≥90% quota). Sync paused until quota resets." },
      { status: 429 }
    );
  }

  const result = await syncOwnAccount(workspace.id, id);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true, mediaCount: result.mediaCount });
}
