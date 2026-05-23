import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { syncOwnAccount, syncCompetitorAccount } from "@/services/accountSyncService";
import { isWorkspaceRateLimited, normalizeInstagramUsername } from "@/services/instagramApiClient";

export async function POST(
  request: NextRequest,
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

  const rateLimited = await isWorkspaceRateLimited(workspace.id);
  if (rateLimited) {
    return NextResponse.json(
      { error: "Meta API rate limit exceeded (≥90% quota). Sync paused until quota resets." },
      { status: 429 }
    );
  }

  const isCompetitor = account.accountType !== "own";
  const rawUsername = account.username;
  const normalizedUsername = isCompetitor ? (normalizeInstagramUsername(rawUsername) ?? rawUsername) : null;

  const result = account.accountType === "own"
    ? await syncOwnAccount(workspace.id, id)
    : await syncCompetitorAccount(workspace.id, id);

  if (!result.success) {
    if (result.status === "requires_live_mode_or_tester") {
      return NextResponse.json({
        success: false,
        status: "requires_live_mode_or_tester",
        rawUsername,
        normalizedUsername,
        message: "Competitor sync requires Meta Live access.",
        details:
          "Your Instagram connection is working, but Meta restricts Business Discovery in Development mode to app tester/role accounts. To sync public competitors, complete Meta App Review, switch the app to Live mode, and ensure the required permissions are approved.",
        ownSyncAvailable: true,
        recommendedActions: [
          "Test with an app tester Instagram account",
          "Prepare Meta App Review",
          "Switch app to Live mode after approval",
        ],
      });
    }
    if (result.status === "invalid_username" || result.status === "invalid_username_or_query_builder_error") {
      return NextResponse.json({
        success: false,
        status: result.status,
        rawUsername,
        normalizedUsername,
        message: "Invalid or unresolvable Instagram username.",
        details: result.error,
        hint: `Use /api/debug/business-discovery-test?username=${encodeURIComponent(rawUsername)} to diagnose.`,
      }, { status: 400 });
    }
    return NextResponse.json({
      success: false,
      status: result.status ?? "error",
      rawUsername,
      normalizedUsername,
      message: result.error ?? "Sync failed.",
      hint: isCompetitor ? `Use /api/debug/business-discovery-test?username=${encodeURIComponent(rawUsername)} to diagnose.` : undefined,
    }, { status: 500 });
  }

  return NextResponse.json({ success: true, mediaCount: result.mediaCount });
}
