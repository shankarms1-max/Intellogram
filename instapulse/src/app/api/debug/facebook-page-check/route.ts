import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";

/**
 * GET /api/debug/facebook-page-check?pageId=<facebookPage-db-id>
 *
 * Returns DB-stored data for a Facebook Page and post summary.
 * Never returns access tokens or encrypted data.
 *
 * Example:
 *   /api/debug/facebook-page-check?pageId=<db-id>
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; name?: string | null };
  const workspace = await getOrCreateDefaultWorkspace(user.id, user.name);

  const pageId = request.nextUrl.searchParams.get("pageId");
  if (!pageId) {
    return NextResponse.json({
      error: "Provide ?pageId=<facebook-page-db-id>",
      example: "/api/debug/facebook-page-check?pageId=<id>",
    }, { status: 400 });
  }

  const fbPage = await db.facebookPage.findFirst({
    where: { id: pageId, workspaceId: workspace.id },
    select: {
      id: true,
      facebookPageId: true,
      name: true,
      category: true,
      pictureUrl: true,
      link: true,
      fanCount: true,
      followersCount: true,
      linkedInstagramAccountId: true,
      linkedInstagramUsername: true,
      discoverySource: true,
      status: true,
      lastSyncedAt: true,
      createdAt: true,
      updatedAt: true,
      // encryptedPageAccessToken intentionally omitted
    },
  });

  if (!fbPage) {
    return NextResponse.json({
      pageFound: false,
      hint: "Run POST /api/meta/discover-pages to discover Facebook Pages.",
    });
  }

  const posts = await db.facebookPagePost.findMany({
    where: { workspaceId: workspace.id, pageDbId: pageId },
    select: {
      id: true,
      facebookPostId: true,
      message: true,
      story: true,
      createdTime: true,
      permalinkUrl: true,
      reactionsCount: true,
      commentsCount: true,
      sharesCount: true,
      engagementCount: true,
      fetchedAt: true,
    },
    orderBy: { createdTime: "desc" },
    take: 200,
  });

  const postsWithReactions = posts.filter((p) => p.reactionsCount != null && p.reactionsCount > 0).length;
  const postsWithComments = posts.filter((p) => p.commentsCount != null && p.commentsCount > 0).length;
  const postsWithShares = posts.filter((p) => p.sharesCount != null && p.sharesCount > 0).length;
  const timestamps = posts.map((p) => p.createdTime.getTime()).filter((t) => !isNaN(t));
  const oldestPost = timestamps.length ? new Date(Math.min(...timestamps)).toISOString() : null;
  const newestPost = timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;

  return NextResponse.json({
    pageFound: true,
    page: {
      id: fbPage.id,
      facebookPageId: fbPage.facebookPageId,
      name: fbPage.name,
      category: fbPage.category,
      pictureUrl: fbPage.pictureUrl,
      link: fbPage.link,
      fanCount: fbPage.fanCount,
      followersCount: fbPage.followersCount,
      linkedInstagramAccountId: fbPage.linkedInstagramAccountId,
      linkedInstagramUsername: fbPage.linkedInstagramUsername,
      discoverySource: fbPage.discoverySource,
      status: fbPage.status,
      lastSyncedAt: fbPage.lastSyncedAt,
    },
    postSummary: {
      totalPosts: posts.length,
      postsWithReactions,
      postsWithComments,
      postsWithShares,
      oldestPost,
      newestPost,
    },
    samplePosts: posts.slice(0, 10).map((p) => ({
      facebookPostId: p.facebookPostId,
      message: p.message?.slice(0, 120),
      story: p.story?.slice(0, 120),
      createdTime: p.createdTime,
      permalinkUrl: p.permalinkUrl,
      reactionsCount: p.reactionsCount,
      commentsCount: p.commentsCount,
      sharesCount: p.sharesCount,
      engagementCount: p.engagementCount,
    })),
  });
}
