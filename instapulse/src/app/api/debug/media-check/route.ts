import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";

/**
 * GET /api/debug/media-check?id=<instagramMediaId>[,<id2>,...]
 *
 * Returns DB-stored data for specific Instagram media IDs so you can verify
 * that viewsCount was persisted after a competitor sync.
 * Never returns access tokens or encrypted data.
 *
 * Example:
 *   /api/debug/media-check?id=18079952732530197,18043682267771164
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; name?: string | null };
  const workspace = await getOrCreateDefaultWorkspace(user.id, user.name);

  const rawIds = request.nextUrl.searchParams.get("id") ?? "";
  const instagramMediaIds = rawIds
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (instagramMediaIds.length === 0) {
    return NextResponse.json({
      error: "Provide one or more Instagram media IDs via ?id=ID1,ID2",
      example: "/api/debug/media-check?id=18079952732530197,18043682267771164",
    }, { status: 400 });
  }

  if (instagramMediaIds.length > 20) {
    return NextResponse.json({ error: "Max 20 IDs per request." }, { status: 400 });
  }

  const rows = await db.mediaItem.findMany({
    where: {
      workspaceId: workspace.id,
      instagramMediaId: { in: instagramMediaIds },
    },
    select: {
      id: true,
      instagramMediaId: true,
      mediaType: true,
      mediaProductType: true,
      timestamp: true,
      likeCount: true,
      commentsCount: true,
      viewsCount: true,
      engagementRate: true,
      fetchedAt: true,
      trackedAccount: { select: { username: true, accountType: true } },
    },
    orderBy: { timestamp: "desc" },
  });

  const found = rows.map((r) => ({
    instagramMediaId: r.instagramMediaId,
    account: `@${r.trackedAccount.username} (${r.trackedAccount.accountType})`,
    mediaType: r.mediaType,
    mediaProductType: r.mediaProductType,
    timestamp: r.timestamp,
    likeCount: r.likeCount,
    commentsCount: r.commentsCount,
    viewsCount: r.viewsCount,
    viewsCountIsNull: r.viewsCount === null,
    engagementRate: r.engagementRate,
    fetchedAt: r.fetchedAt,
  }));

  const missingIds = instagramMediaIds.filter(
    (id) => !rows.some((r) => r.instagramMediaId === id)
  );

  return NextResponse.json({
    queriedIds: instagramMediaIds,
    found,
    missingFromDb: missingIds,
    totalFound: found.length,
    hint: found.some((r) => r.viewsCountIsNull)
      ? "Some rows have viewsCount = null. Re-sync the competitor account after the latest deployment to backfill view_count for recent posts. Use /deep-import for older posts."
      : "All queried rows have viewsCount stored.",
  });
}
