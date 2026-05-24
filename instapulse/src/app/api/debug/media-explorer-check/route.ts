import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";

/**
 * GET /api/debug/media-explorer-check?accountId=<trackedAccountId>
 *
 * Uses the same query as Media Explorer to confirm viewsCount is present in
 * the data source. If media-check shows viewsCount but Media Explorer still
 * shows blank, this route reveals whether the data-fetch layer is the gap.
 *
 * Never returns access tokens or encrypted data.
 *
 * Example:
 *   /api/debug/media-explorer-check?accountId=<nike-tracked-account-id>
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; name?: string | null };
  const workspace = await getOrCreateDefaultWorkspace(user.id, user.name);

  const accountId = request.nextUrl.searchParams.get("accountId");
  if (!accountId) {
    return NextResponse.json({
      error: "Provide ?accountId=<trackedAccountId>",
      example: "/api/debug/media-explorer-check?accountId=<nike-account-id>",
    }, { status: 400 });
  }

  // Confirm the account belongs to this workspace
  const account = await db.trackedAccount.findFirst({
    where: { id: accountId, workspaceId: workspace.id },
    select: { id: true, username: true, accountType: true },
  });

  if (!account) {
    return NextResponse.json({ error: "Account not found in this workspace." }, { status: 404 });
  }

  // Use the exact same query as /api/media (include, not select) so viewsCount is returned
  const items = await db.mediaItem.findMany({
    where: { workspaceId: workspace.id, trackedAccountId: accountId },
    include: {
      trackedAccount: { select: { username: true, accountType: true, profilePictureUrl: true } },
    },
    orderBy: { timestamp: "desc" },
    take: 50,
  });

  const totalRows = items.length;
  const videoRows = items.filter((r) => r.mediaType === "VIDEO").length;
  const reelsRows = items.filter((r) => r.mediaProductType === "REELS").length;
  const rowsWithViewsCount = items.filter((r) => r.viewsCount != null).length;
  const rowsWithoutViewsCount = totalRows - rowsWithViewsCount;

  const sampleRows = items.slice(0, 10).map((r) => ({
    id: r.id,
    instagramMediaId: r.instagramMediaId,
    mediaType: r.mediaType,
    mediaProductType: r.mediaProductType,
    viewsCount: r.viewsCount,
    likeCount: r.likeCount,
    commentsCount: r.commentsCount,
    permalink: r.permalink,
    timestamp: r.timestamp,
    fetchedAt: r.fetchedAt,
    updatedAt: r.updatedAt,
  }));

  return NextResponse.json({
    accountId,
    accountUsername: `@${account.username}`,
    accountType: account.accountType,
    note: "Showing up to 50 most recent items (same query as Media Explorer). viewsCount null = not returned by Meta or synced before view_count was added to the query.",
    totalRows,
    videoRows,
    reelsRows,
    rowsWithViewsCount,
    rowsWithoutViewsCount,
    sampleRows,
    hint: rowsWithViewsCount === 0
      ? "No rows have viewsCount. Trigger POST /api/accounts/<id>/deep-import to backfill, then re-check."
      : `${rowsWithViewsCount} of ${totalRows} rows have viewsCount stored.`,
  });
}
