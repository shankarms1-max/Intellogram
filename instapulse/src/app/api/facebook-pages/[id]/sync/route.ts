import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { isWorkspaceRateLimited } from "@/services/instagramApiClient";
import { syncFacebookPagePosts, FacebookSyncMode } from "@/services/facebookSyncService";

/**
 * POST /api/facebook-pages/[id]/sync
 *
 * Syncs posts for a Facebook Page.
 * Body: { syncMode?: "daily_refresh" | "initial_import" }
 * Defaults to daily_refresh for manual triggers.
 * manual_deep_import is only available via /deep-import.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; name?: string | null };
  const workspace = await getOrCreateDefaultWorkspace(user.id, user.name);
  const { id } = await params;

  const page = await db.facebookPage.findFirst({
    where: { id, workspaceId: workspace.id },
  });
  if (!page) return NextResponse.json({ error: "Facebook Page not found" }, { status: 404 });

  const rateLimited = await isWorkspaceRateLimited(workspace.id);
  if (rateLimited) {
    return NextResponse.json(
      { error: "Meta API rate limit exceeded (≥90% quota). Sync paused until quota resets." },
      { status: 429 }
    );
  }

  // Parse optional syncMode; default to initial_import if page has never synced
  let syncMode: FacebookSyncMode = page.lastSyncedAt ? "daily_refresh" : "initial_import";
  try {
    const body = (await request.json()) as { syncMode?: string };
    if (body?.syncMode === "daily_refresh" || body?.syncMode === "initial_import") {
      syncMode = body.syncMode;
    }
    // manual_deep_import blocked here — use /deep-import endpoint
  } catch { /* no body */ }

  const result = await syncFacebookPagePosts(workspace.id, id, syncMode);

  if (!result.success) {
    return NextResponse.json(
      { success: false, status: result.status ?? "error", message: result.error ?? "Sync failed." },
      { status: result.status === "no_page_token" ? 400 : 500 }
    );
  }

  return NextResponse.json({
    success: true,
    platform: "facebook",
    syncMode: result.syncMode,
    requestedLimit: result.requestedLimit,
    fetchedPostCount: result.fetchedPostCount,
    upsertedPostCount: result.upsertedPostCount,
    pagesFetched: result.pagesFetched,
    oldestFetchedTimestamp: result.oldestFetchedTimestamp,
    newestFetchedTimestamp: result.newestFetchedTimestamp,
    stoppedReason: result.stoppedReason,
  });
}
