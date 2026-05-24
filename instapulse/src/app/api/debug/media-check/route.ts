import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";

/**
 * GET /api/debug/media-check?id=<instagramMediaId>[,<id2>,...]&accountId=<optionalAccountId>
 *
 * Returns DB-stored data for specific Instagram media IDs so you can verify
 * that viewsCount was persisted after a competitor sync.
 * Never returns access tokens or encrypted data.
 *
 * Example:
 *   /api/debug/media-check?id=18079952732530197,18043682267771164
 *   /api/debug/media-check?id=18079952732530197&accountId=<trackedAccountId>
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

  const accountId = request.nextUrl.searchParams.get("accountId") ?? undefined;

  const rows = await db.mediaItem.findMany({
    where: {
      workspaceId: workspace.id,
      instagramMediaId: { in: instagramMediaIds },
      ...(accountId ? { trackedAccountId: accountId } : {}),
    },
    select: {
      id: true,
      instagramMediaId: true,
      trackedAccountId: true,
      mediaType: true,
      mediaProductType: true,
      permalink: true,
      timestamp: true,
      likeCount: true,
      commentsCount: true,
      viewsCount: true,
      engagementRate: true,
      fetchedAt: true,
      updatedAt: true,
      trackedAccount: { select: { username: true, accountType: true } },
    },
    orderBy: { timestamp: "desc" },
  });

  const found = instagramMediaIds.map((requestedId) => {
    const row = rows.find((r) => r.instagramMediaId === requestedId);
    if (!row) {
      return { requestedId, found: false };
    }
    return {
      requestedId,
      found: true,
      dbId: row.id,
      instagramMediaId: row.instagramMediaId,
      accountId: row.trackedAccountId,
      accountUsername: `@${row.trackedAccount.username}`,
      platform: "instagram",
      accountType: row.trackedAccount.accountType,
      mediaType: row.mediaType,
      mediaProductType: row.mediaProductType,
      permalink: row.permalink,
      timestamp: row.timestamp,
      viewsCount: row.viewsCount,
      likeCount: row.likeCount,
      commentsCount: row.commentsCount,
      engagementRate: row.engagementRate,
      fetchedAt: row.fetchedAt,
      updatedAt: row.updatedAt,
    };
  });

  const foundRows = found.filter((r) => r.found);
  const missingIds = found.filter((r) => !r.found).map((r) => r.requestedId);
  const withViewsCount = foundRows.filter(
    (r) => (r as { viewsCount?: number | null }).viewsCount != null
  ).length;
  const withoutViewsCount = foundRows.length - withViewsCount;

  const anyNullViews = foundRows.some(
    (r) => (r as { viewsCount?: number | null }).viewsCount == null
  );

  return NextResponse.json({
    queriedIds: instagramMediaIds,
    found,
    summary: {
      requestedCount: instagramMediaIds.length,
      foundCount: foundRows.length,
      missingCount: missingIds.length,
      withViewsCount,
      withoutViewsCount,
    },
    missingFromDb: missingIds,
    hint: anyNullViews
      ? "Some rows have viewsCount = null. Re-sync the competitor account after the latest deployment to backfill view_count for recent posts. Use /deep-import for older posts."
      : foundRows.length > 0
        ? "All queried rows have viewsCount stored."
        : "No rows found — trigger a deep-import for the competitor account first.",
  });
}
