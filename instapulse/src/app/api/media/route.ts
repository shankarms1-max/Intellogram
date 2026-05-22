import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; name?: string | null };
  const workspace = await getOrCreateDefaultWorkspace(user.id, user.name);

  const url = new URL(req.url);
  const accountId = url.searchParams.get("accountId");
  const mediaType = url.searchParams.get("mediaType");
  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo = url.searchParams.get("dateTo");
  const search = url.searchParams.get("search");
  const sortBy = url.searchParams.get("sortBy") || "timestamp";
  const sortOrder = (url.searchParams.get("sortOrder") || "desc") as "asc" | "desc";
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10), 100);

  const where = {
    workspaceId: workspace.id,
    ...(accountId ? { trackedAccountId: accountId } : {}),
    ...(mediaType ? { mediaType } : {}),
    ...((dateFrom || dateTo)
      ? {
          timestamp: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo) } : {}),
          },
        }
      : {}),
    ...(search ? { caption: { contains: search, mode: "insensitive" as const } } : {}),
  };

  const validSortFields = ["timestamp", "likeCount", "commentsCount", "viewsCount", "engagementRate"];
  const orderBy = { [validSortFields.includes(sortBy) ? sortBy : "timestamp"]: sortOrder };

  const [items, total] = await Promise.all([
    db.mediaItem.findMany({
      where,
      include: { trackedAccount: { select: { username: true, accountType: true, profilePictureUrl: true } } },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.mediaItem.count({ where }),
  ]);

  return NextResponse.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
}
