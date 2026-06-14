import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";

/**
 * GET /api/meta/discovered-assets
 *
 * Returns two independent datasets:
 *   assets       — InstagramConnections enriched with linked TrackedAccount + FacebookPage
 *   ownAccounts  — all TrackedAccount rows with accountType=own (direct, no join)
 *
 * Each section is fetched independently so a failure in one does not block the other.
 * Never returns 500 — always 200 with whatever data was available and a diagnostics block.
 * No tokens or secrets are included in the response.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; name?: string | null };
  const workspace = await getOrCreateDefaultWorkspace(user.id, user.name);

  const diag: Record<string, unknown> = {
    userId: user.id,
    workspaceId: workspace.id,
    connectionsFound: 0,
    pagesFound: 0,
    ownAccountsFound: 0,
    errors: [] as string[],
  };

  // ── 1. Fetch InstagramConnections (source of OAuth tokens) ─────────────────

  let connections: Awaited<ReturnType<typeof db.instagramConnection.findMany>> = [];
  try {
    connections = await db.instagramConnection.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { updatedAt: "desc" },
    });
    diag.connectionsFound = connections.length;
    console.log(`[discovered-assets] userId=${user.id} workspaceId=${workspace.id} connections=${connections.length}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    (diag.errors as string[]).push(`connections: ${msg}`);
    console.error("[discovered-assets] Error fetching InstagramConnections:", msg);
  }

  // ── 2. Fetch FacebookPages ─────────────────────────────────────────────────

  let pages: Awaited<ReturnType<typeof db.facebookPage.findMany>> = [];
  try {
    pages = await db.facebookPage.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { name: "asc" },
    });
    diag.pagesFound = pages.length;
    console.log(`[discovered-assets] facebookPages=${pages.length}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    (diag.errors as string[]).push(`pages: ${msg}`);
    console.error("[discovered-assets] Error fetching FacebookPages:", msg);
  }

  // ── 3. Fetch own TrackedAccounts — independent from connections ───────────
  //
  // Use an explicit select so that if the connectionId column is somehow
  // missing in the production DB, only this fallback path is affected.

  type OwnAccount = {
    id: string;
    username: string;
    displayName: string | null;
    profilePictureUrl: string | null;
    followersCount: number | null;
    mediaCount: number | null;
    status: string;
    lastSyncedAt: Date | null;
    isActive: boolean;
    instagramUserId: string | null;
    connectionId: string | null;
  };

  let ownAccounts: OwnAccount[] = [];
  try {
    ownAccounts = await db.trackedAccount.findMany({
      where: { workspaceId: workspace.id, accountType: "own" },
      select: {
        id: true,
        username: true,
        displayName: true,
        profilePictureUrl: true,
        followersCount: true,
        mediaCount: true,
        status: true,
        lastSyncedAt: true,
        isActive: true,
        instagramUserId: true,
        connectionId: true,
      },
      orderBy: { createdAt: "asc" },
    });
    diag.ownAccountsFound = ownAccounts.length;
    console.log(`[discovered-assets] ownAccounts=${ownAccounts.length}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    (diag.errors as string[]).push(`ownAccounts(with connectionId): ${msg}`);
    console.error("[discovered-assets] Error fetching own TrackedAccounts (with connectionId):", msg);

    // Fallback: retry without connectionId in case column is missing in production DB
    try {
      const fallback = await db.trackedAccount.findMany({
        where: { workspaceId: workspace.id, accountType: "own" },
        select: {
          id: true,
          username: true,
          displayName: true,
          profilePictureUrl: true,
          followersCount: true,
          mediaCount: true,
          status: true,
          lastSyncedAt: true,
          isActive: true,
          instagramUserId: true,
        },
        orderBy: { createdAt: "asc" },
      });
      ownAccounts = fallback.map((a) => ({ ...a, connectionId: null }));
      diag.ownAccountsFound = ownAccounts.length;
      (diag.errors as string[]).push("ownAccounts: used fallback select (connectionId column may be missing)");
      console.log(`[discovered-assets] ownAccounts fallback=${ownAccounts.length}`);
    } catch (e2) {
      const msg2 = e2 instanceof Error ? e2.message : String(e2);
      (diag.errors as string[]).push(`ownAccounts(fallback): ${msg2}`);
      console.error("[discovered-assets] Fallback own accounts query also failed:", msg2);
    }
  }

  // ── 4. Build assets list from connections ──────────────────────────────────

  // Index own accounts by instagramUserId for O(1) lookup
  const ownByIgId = new Map<string, OwnAccount>();
  for (const ta of ownAccounts) {
    if (ta.instagramUserId) ownByIgId.set(ta.instagramUserId, ta);
  }

  // Index Facebook Pages by linked IG account id
  const pageByIgId = new Map(
    pages
      .filter((p) => p.linkedInstagramAccountId)
      .map((p) => [p.linkedInstagramAccountId!, p])
  );

  const connectedIgIds = new Set(connections.map((c) => c.instagramUserId));

  const assets = connections.map((conn) => {
    const ta = ownByIgId.get(conn.instagramUserId);
    const page = pageByIgId.get(conn.instagramUserId);
    return {
      source: "instagram_connection" as const,
      isAuthorized: true as const,
      connectionId: conn.id,
      instagramUserId: conn.instagramUserId,
      instagramUsername: conn.instagramUsername,
      displayName: ta?.displayName ?? null,
      profilePictureUrl: ta?.profilePictureUrl ?? null,
      followersCount: ta?.followersCount ?? null,
      status: conn.status,
      tokenExpiresAt: conn.tokenExpiresAt,
      scopes: conn.scopes,
      updatedAt: conn.updatedAt,
      // isTrackedAsOwn: true when an own-type TrackedAccount exists for this connection
      isTrackedAsOwn: ta !== undefined,
      trackedAccountId: ta?.id ?? null,
      // Full tracked account for detailed display
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

  // Facebook Page-sourced assets: pages with a linked IG account that has no direct connection.
  // These are still authorized (discovered via Meta OAuth) and can be tracked as own.
  const pageOnlyAssets = pages
    .filter((p) => p.linkedInstagramAccountId && !connectedIgIds.has(p.linkedInstagramAccountId))
    .map((p) => {
      const igId = p.linkedInstagramAccountId!;
      const ta = ownByIgId.get(igId);
      return {
        source: "facebook_page" as const,
        isAuthorized: true as const,
        connectionId: null,
        instagramUserId: igId,
        instagramUsername: p.linkedInstagramUsername ?? igId,
        displayName: ta?.displayName ?? null,
        profilePictureUrl: ta?.profilePictureUrl ?? null,
        followersCount: ta?.followersCount ?? null,
        status: "active" as const,
        tokenExpiresAt: null,
        scopes: [],
        updatedAt: p.updatedAt,
        isTrackedAsOwn: ta !== undefined,
        trackedAccountId: ta?.id ?? null,
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
        facebookPage: {
          id: p.id,
          facebookPageId: p.facebookPageId,
          name: p.name,
          pictureUrl: p.pictureUrl,
          category: p.category,
        },
      };
    });

  const allAssets = [...assets, ...pageOnlyAssets];
  diag.assetsFound = allAssets.length;
  diag.assetsNotTrackedAsOwn = allAssets.filter((a) => !a.isTrackedAsOwn).length;
  console.log(`[discovered-assets] allAssets=${allAssets.length} notTracked=${diag.assetsNotTrackedAsOwn}`);

  // Orphan pages listed separately (backward compat)
  const orphanPages = pages
    .filter((p) => p.linkedInstagramAccountId && !connectedIgIds.has(p.linkedInstagramAccountId))
    .map((p) => ({
      id: p.id,
      facebookPageId: p.facebookPageId,
      name: p.name,
      pictureUrl: p.pictureUrl,
      category: p.category,
      linkedInstagramAccountId: p.linkedInstagramAccountId,
      linkedInstagramUsername: p.linkedInstagramUsername,
    }));

  // ownAccounts for Section 2 — all own accounts, even those without a connection
  const ownAccountsResponse = ownAccounts.map((ta) => ({
    id: ta.id,
    username: ta.username,
    displayName: ta.displayName,
    profilePictureUrl: ta.profilePictureUrl,
    followersCount: ta.followersCount,
    mediaCount: ta.mediaCount,
    status: ta.status,
    lastSyncedAt: ta.lastSyncedAt,
    isActive: ta.isActive,
    instagramUserId: ta.instagramUserId,
    connectionId: ta.connectionId,
    // Whether this own account has a matching active connection
    hasConnection: ta.instagramUserId ? connectedIgIds.has(ta.instagramUserId) : false,
  }));

  return NextResponse.json({
    assets: allAssets,
    ownAccounts: ownAccountsResponse,
    orphanPages,
    _diag: diag,
  });
}
