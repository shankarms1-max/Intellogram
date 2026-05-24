import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { decryptToken } from "@/lib/encryption";
import { isWorkspaceRateLimited } from "@/services/instagramApiClient";
import { discoverAndStorePages } from "@/services/facebookSyncService";

/**
 * POST /api/meta/discover-pages
 *
 * Discovers Facebook Pages accessible via the workspace's Meta connection,
 * stores them (with encrypted access tokens), and returns a safe page list.
 * Never exposes access tokens in the response.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; name?: string | null };
  const workspace = await getOrCreateDefaultWorkspace(user.id, user.name);

  const rateLimited = await isWorkspaceRateLimited(workspace.id);
  if (rateLimited) {
    return NextResponse.json(
      { error: "Meta API rate limit exceeded (≥90% quota). Discovery paused until quota resets." },
      { status: 429 }
    );
  }

  // Resolve access token from active connection or workspace credential
  let accessToken: string | null = null;

  const conn = await db.instagramConnection.findFirst({
    where: { workspaceId: workspace.id, status: "active" },
    orderBy: { updatedAt: "desc" },
  });
  if (conn?.accessTokenEncrypted) {
    try { accessToken = decryptToken(conn.accessTokenEncrypted); } catch { /* fall through */ }
  }

  if (!accessToken) {
    const cred = await db.workspaceCredential.findUnique({ where: { workspaceId: workspace.id } });
    if (cred?.accessTokenEncrypted) {
      try { accessToken = decryptToken(cred.accessTokenEncrypted); } catch { /* fall through */ }
    }
  }

  if (!accessToken) {
    return NextResponse.json(
      {
        error: "No active Meta connection found. Connect your Instagram/Facebook account first.",
        hint: "Go to Settings → Connect Facebook & Instagram to connect your Meta account.",
      },
      { status: 400 }
    );
  }

  const { pagesDiscovered, pages } = await discoverAndStorePages(workspace.id, accessToken);

  return NextResponse.json({
    pagesDiscovered,
    pages: pages.map((p) => ({
      id: p.id,
      facebookPageId: p.facebookPageId,
      name: p.name,
      category: p.category,
      pictureUrl: p.pictureUrl,
      link: p.link,
      fanCount: p.fanCount,
      followersCount: p.followersCount,
      linkedInstagramUsername: p.linkedInstagramUsername,
      linkedInstagramAccountId: p.linkedInstagramAccountId,
      discoverySource: p.discoverySource,
      status: p.status,
    })),
    hint:
      pagesDiscovered === 0
        ? "No Facebook Pages found. Ensure pages_show_list permission is granted in your Meta app and your Pages are accessible."
        : undefined,
  });
}
