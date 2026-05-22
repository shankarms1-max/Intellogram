import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { id: string; name?: string | null };
  const workspace = await getOrCreateDefaultWorkspace(user.id, user.name);

  const connections = await db.instagramConnection.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      instagramUserId: true,
      instagramUsername: true,
      status: true,
      scopes: true,
      tokenExpiresAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ connections });
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { id: string; name?: string | null };
  const workspace = await getOrCreateDefaultWorkspace(user.id, user.name);

  const { searchParams } = new URL(request.url);
  const instagramUserId = searchParams.get("instagramUserId");

  if (!instagramUserId) {
    return NextResponse.json({ error: "instagramUserId is required" }, { status: 400 });
  }

  await db.instagramConnection.updateMany({
    where: { workspaceId: workspace.id, instagramUserId },
    data: { status: "disconnected" },
  });

  return NextResponse.json({ success: true });
}
