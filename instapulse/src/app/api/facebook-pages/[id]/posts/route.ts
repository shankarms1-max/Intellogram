import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";

/**
 * GET /api/facebook-pages/[id]/posts
 *
 * Returns paginated posts for a Facebook Page from the DB.
 * Query params: page, limit, sortBy, sortOrder
 * Never exposes access tokens.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; name?: string | null };
  const workspace = await getOrCreateDefaultWorkspace(user.id, user.name);
  const { id } = await params;

  const fbPage = await db.facebookPage.findFirst({
    where: { id, workspaceId: workspace.id },
    select: { id: true, name: true, facebookPageId: true, pictureUrl: true },
  });
  if (!fbPage) return NextResponse.json({ error: "Facebook Page not found" }, { status: 404 });

  const sp = request.nextUrl.searchParams;
  const pageNum = Math.max(1, Number(sp.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit") ?? "20")));
  const sortBy = (sp.get("sortBy") ?? "createdTime") as "createdTime" | "reactionsCount" | "commentsCount" | "sharesCount" | "engagementCount";
  const sortOrder = sp.get("sortOrder") === "asc" ? "asc" : "desc";

  const validSortFields = ["createdTime", "reactionsCount", "commentsCount", "sharesCount", "engagementCount"] as const;
  type ValidSort = (typeof validSortFields)[number];
  const safeSort: ValidSort = (validSortFields as readonly string[]).includes(sortBy)
    ? (sortBy as ValidSort)
    : "createdTime";
  const orderBy: Record<ValidSort, "asc" | "desc"> = { [safeSort]: sortOrder } as Record<ValidSort, "asc" | "desc">;

  const total = await db.facebookPagePost.count({
    where: { workspaceId: workspace.id, pageDbId: id },
  });

  const posts = await db.facebookPagePost.findMany({
    where: { workspaceId: workspace.id, pageDbId: id },
    select: {
      id: true,
      facebookPostId: true,
      message: true,
      story: true,
      createdTime: true,
      permalinkUrl: true,
      fullPicture: true,
      attachmentType: true,
      reactionsCount: true,
      commentsCount: true,
      sharesCount: true,
      engagementCount: true,
      fetchedAt: true,
    },
    orderBy,
    skip: (pageNum - 1) * limit,
    take: limit,
  });

  return NextResponse.json({
    fbPage: {
      id: fbPage.id,
      name: fbPage.name,
      facebookPageId: fbPage.facebookPageId,
      pictureUrl: fbPage.pictureUrl,
    },
    posts,
    total,
    pages: Math.ceil(total / limit),
    currentPage: pageNum,
  });
}
