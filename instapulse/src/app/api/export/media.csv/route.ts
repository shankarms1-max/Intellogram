import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { generateMediaCsv } from "@/services/csvImportService";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const user = session.user as { id: string; name?: string | null };
  const workspace = await getOrCreateDefaultWorkspace(user.id, user.name);

  const url = new URL(req.url);
  const accountId = url.searchParams.get("accountId");

  const items = await db.mediaItem.findMany({
    where: {
      workspaceId: workspace.id,
      ...(accountId ? { trackedAccountId: accountId } : {}),
    },
    include: { trackedAccount: { select: { username: true } } },
    orderBy: { timestamp: "desc" },
    take: 1000,
  });

  const csv = generateMediaCsv(items);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="instapulse-media-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
