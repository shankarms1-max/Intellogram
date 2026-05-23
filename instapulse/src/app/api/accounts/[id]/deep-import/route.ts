import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { syncCompetitorAccount } from "@/services/accountSyncService";
import { isWorkspaceRateLimited } from "@/services/instagramApiClient";

/**
 * POST /api/accounts/[id]/deep-import
 * Triggers a manual_deep_import sync (up to 500 posts, 20 pages) for a competitor account.
 * Not callable from cron — manual/admin trigger only.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  if (account.accountType === "own") {
    return NextResponse.json(
      { error: "Deep import is only available for competitor accounts." },
      { status: 400 }
    );
  }

  const rateLimited = await isWorkspaceRateLimited(workspace.id);
  if (rateLimited) {
    return NextResponse.json(
      { error: "Meta API rate limit exceeded (≥90% quota). Deep import paused until quota resets." },
      { status: 429 }
    );
  }

  const result = await syncCompetitorAccount(workspace.id, id, "manual_deep_import");

  if (!result.success) {
    return NextResponse.json({
      success: false,
      status: result.status ?? "error",
      message: result.error ?? "Deep import failed.",
      syncMode: "manual_deep_import",
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    syncMode: "manual_deep_import",
    mediaCount: result.mediaCount,
    pagesFetched: result.pagesFetched,
    stoppedReason: result.stoppedReason,
    note: "Deep import fetches up to 500 available competitor posts using Meta pagination. May stop early if rate limits are high or no older media is available.",
  });
}
