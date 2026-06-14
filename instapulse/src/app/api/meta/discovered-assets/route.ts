import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";

/**
 * GET /api/meta/discovered-assets
 *
 * Returns all InstagramConnections for the workspace, enriched with:
 * - the linked TrackedAccount (if tracked as "own")
 * - the linked FacebookPage (matched by linkedInstagramAccountId)
 *
 * No tokens are exposed in the response.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; name?: string | null };
  const workspace = await getOrCreateDefaultWorkspace(user.id, user.name);

  const [connections, pages, trackedOwn] = await Promise.all([
    db.instagramConnection.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { updatedAt: "desc" },
    }),
    db.facebookPage.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { name: "asc" },
    }),
    db.trackedAccount.findMany({
      where: { workspaceId: workspace.id, accountType: "own" },
    }),
  ]);

  // Build lookup: instagramUserId → owned TrackedAccount
  const ownByIgId = new Map(trackedOwn.map((ta) => [ta.instagramUserId, ta]));
  // Build lookup: linkedInstagramAccountId → FacebookPage
  const pageByIgId = new Map(
    pages
      .filter((p) => p.linkedInstagramAccountId)
      .map((p) => [p.linkedInstagramAccountId!, p])
  );

  const assets = connections.map((conn) => {
    const ta = ownByIgId.get(conn.instagramUserId);
    const page = pageByIgId.get(conn.instagramUserId);
    return {
      connectionId: conn.id,
      instagramUserId: conn.instagramUserId,
      instagramUsername: conn.instagramUsername,
      status: conn.status,
      tokenExpiresAt: conn.tokenExpiresAt,
      scopes: conn.scopes,
      updatedAt: conn.updatedAt,
      trackedAccount: ta
        ? {
            id: ta.id,
            username: ta.username,
            displayName: ta.displayName,
            profilePictureUrl: ta.profilePictureUrl,
            followersCount: ta.followersCount,
            mediaCount: ta.mediaCount,
            status: ta.status,
            lastSyncedAt: ta.lastSyncedAt,
            isActive: ta.isActive,
          }
        : null,
      facebookPage: page
        ? {
            id: page.id,
            facebookPageId: page.facebookPageId,
            name: page.name,
            pictureUrl: page.pictureUrl,
            category: page.category,
          }
        : null,
    };
  });

  // Also surface pages whose linked IG account has no matching connection
  // (e.g., page discovered but no OAuth connection stored yet)
  const connectedIgIds = new Set(connections.map((c) => c.instagramUserId));
  const orphanPages = pages.filter(
    (p) => p.linkedInstagramAccountId && !connectedIgIds.has(p.linkedInstagramAccountId)
  );

  return NextResponse.json({
    assets,
    orphanPages: orphanPages.map((p) => ({
      id: p.id,
      facebookPageId: p.facebookPageId,
      name: p.name,
      pictureUrl: p.pictureUrl,
      category: p.category,
      linkedInstagramAccountId: p.linkedInstagramAccountId,
      linkedInstagramUsername: p.linkedInstagramUsername,
    })),
  });
}
