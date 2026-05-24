import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { isWorkspaceRateLimited } from "@/services/instagramApiClient";
import { syncFacebookPagePosts } from "@/services/facebookSyncService";

/**
 * POST /api/facebook-pages/[id]/deep-import
 *
 * Triggers a manual_deep_import (up to 500 posts, 20 pages) for a Facebook Page.
 * Not callable from cron — manual/admin trigger only.
 */
export async function POST(
  _request: NextRequest,
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
      { error: "Meta API rate limit exceeded (≥90% quota). Deep import paused until quota resets." },
      { status: 429 }
    );
  }

  const result = await syncFacebookPagePosts(workspace.id, id, "manual_deep_import");

  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        status: result.status ?? "error",
        message: result.error ?? "Deep import failed.",
        platform: "facebook",
        syncMode: "manual_deep_import",
      },
      { status: result.status === "no_page_token" ? 400 : 500 }
    );
  }

  return NextResponse.json({
    success: true,
    platform: "facebook",
    syncMode: "manual_deep_import",
    requestedLimit: result.requestedLimit,
    fetchedPostCount: result.fetchedPostCount,
    upsertedPostCount: result.upsertedPostCount,
    pagesFetched: result.pagesFetched,
    oldestFetchedTimestamp: result.oldestFetchedTimestamp,
    newestFetchedTimestamp: result.newestFetchedTimestamp,
    stoppedReason: result.stoppedReason,
    note: "Deep import fetches up to 500 Facebook Page posts using pagination.",
  });
}
