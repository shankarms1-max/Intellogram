import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; name?: string | null };
  const workspace = await getOrCreateDefaultWorkspace(user.id, user.name);

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const filter = searchParams.get("filter"); // "success" | "error" | null
  const limit = 50;
  const skip = (page - 1) * limit;

  const where = {
    workspaceId: workspace.id,
    ...(filter === "success" ? { success: true } : filter === "error" ? { success: false } : {}),
  };

  const [logs, total] = await Promise.all([
    db.apiLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip,
    }),
    db.apiLog.count({ where }),
  ]);

  return NextResponse.json({ logs, total, page, limit });
}
