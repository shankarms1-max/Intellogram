import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";

/**
 * GET /api/meta/primary-discovery
 * Returns the current primary own Instagram account used for competitor Business Discovery.
 * Reads workspaceCredential.igBusinessAccountId, resolved to the matching TrackedAccount.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; name?: string | null };
  const workspace = await getOrCreateDefaultWorkspace(user.id, user.name);

  const cred = await db.workspaceCredential.findUnique({ where: { workspaceId: workspace.id } });
  const igBusinessAccountId = cred?.igBusinessAccountId ?? null;

  if (!igBusinessAccountId) {
    // Fall back to first active connection's IG user
    const conn = await db.instagramConnection.findFirst({
      where: { workspaceId: workspace.id, status: "active" },
      orderBy: { updatedAt: "desc" },
    });
    if (conn) {
      return NextResponse.json({
        instagramUserId: conn.instagramUserId,
        instagramUsername: conn.instagramUsername,
        source: "fallback_connection",
      });
    }
    return NextResponse.json({ instagramUserId: null, instagramUsername: null, source: null });
  }

  const ta = await db.trackedAccount.findFirst({
    where: { workspaceId: workspace.id, instagramUserId: igBusinessAccountId, accountType: "own" },
  });

  return NextResponse.json({
    instagramUserId: igBusinessAccountId,
    instagramUsername: ta?.username ?? null,
    displayName: ta?.displayName ?? null,
    profilePictureUrl: ta?.profilePictureUrl ?? null,
    followersCount: ta?.followersCount ?? null,
    trackedAccountId: ta?.id ?? null,
    source: "configured",
  });
}

/**
 * POST /api/meta/primary-discovery
 * Body: { instagramUserId: string }
 * Sets the primary own Instagram account for competitor Business Discovery.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; name?: string | null };
  const workspace = await getOrCreateDefaultWorkspace(user.id, user.name);

  const body = await request.json() as { instagramUserId?: string };
  const { instagramUserId } = body;

  if (!instagramUserId) {
    return NextResponse.json({ error: "instagramUserId is required" }, { status: 400 });
  }

  // Verify the IG account belongs to this workspace (own account only)
  const ta = await db.trackedAccount.findFirst({
    where: { workspaceId: workspace.id, instagramUserId, accountType: "own" },
  });
  if (!ta) {
    return NextResponse.json(
      { error: "No own account with that Instagram User ID found in this workspace" },
      { status: 404 }
    );
  }

  // Upsert WorkspaceCredential with the new primary discovery account
  await db.workspaceCredential.upsert({
    where: { workspaceId: workspace.id },
    update: { igBusinessAccountId: instagramUserId },
    create: { workspaceId: workspace.id, igBusinessAccountId: instagramUserId },
  });

  return NextResponse.json({
    success: true,
    instagramUserId,
    instagramUsername: ta.username,
  });
}
