import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";

/**
 * GET /api/debug/meta-assets-check
 *
 * Returns a cross-platform asset overview:
 * - Instagram accounts (tracked)
 * - Facebook Pages
 * - Linked IG ↔ FB Page pairs
 *
 * Never exposes access tokens.
 *
 * Example:
 *   /api/debug/meta-assets-check
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; name?: string | null };
  const workspace = await getOrCreateDefaultWorkspace(user.id, user.name);

  const [instagramAccounts, facebookPages] = await Promise.all([
    db.trackedAccount.findMany({
      where: { workspaceId: workspace.id, accountType: "own" },
      select: {
        id: true,
        instagramUserId: true,
        username: true,
        displayName: true,
        followersCount: true,
        status: true,
        lastSyncedAt: true,
      },
    }),
    db.facebookPage.findMany({
      where: { workspaceId: workspace.id },
      select: {
        id: true,
        facebookPageId: true,
        name: true,
        category: true,
        fanCount: true,
        followersCount: true,
        linkedInstagramAccountId: true,
        linkedInstagramUsername: true,
        status: true,
        lastSyncedAt: true,
        // encryptedPageAccessToken intentionally omitted
      },
    }),
  ]);

  const linkedPairs = facebookPages
    .filter((p) => p.linkedInstagramAccountId || p.linkedInstagramUsername)
    .map((p) => ({
      facebookPageId: p.facebookPageId,
      pageName: p.name,
      instagramBusinessAccountId: p.linkedInstagramAccountId,
      instagramUsername: p.linkedInstagramUsername,
    }));

  const linkedInstagramAccountIds = new Set(
    linkedPairs.map((p) => p.instagramBusinessAccountId).filter(Boolean)
  );
  const linkedInstagramUsernames = new Set(
    linkedPairs.map((p) => p.instagramUsername).filter(Boolean)
  );

  const unlinkedInstagramAccounts = instagramAccounts.filter(
    (a) => !linkedInstagramAccountIds.has(a.instagramUserId ?? "") &&
           !linkedInstagramUsernames.has(a.username)
  );

  const linkedPageIds = new Set(linkedPairs.map((p) => p.facebookPageId));
  const unlinkedFacebookPages = facebookPages.filter(
    (p) => !linkedPageIds.has(p.facebookPageId)
  );

  return NextResponse.json({
    instagramAccountsCount: instagramAccounts.length,
    facebookPagesCount: facebookPages.length,
    linkedPairsCount: linkedPairs.length,
    instagramAccounts: instagramAccounts.map((a) => ({
      id: a.id,
      instagramUserId: a.instagramUserId,
      username: a.username,
      displayName: a.displayName,
      followersCount: a.followersCount,
      status: a.status,
      lastSyncedAt: a.lastSyncedAt,
    })),
    facebookPages: facebookPages.map((p) => ({
      id: p.id,
      facebookPageId: p.facebookPageId,
      name: p.name,
      category: p.category,
      fanCount: p.fanCount,
      followersCount: p.followersCount,
      linkedInstagramAccountId: p.linkedInstagramAccountId,
      linkedInstagramUsername: p.linkedInstagramUsername,
      status: p.status,
      lastSyncedAt: p.lastSyncedAt,
    })),
    linkedAssets: linkedPairs,
    unlinkedInstagramAccounts: unlinkedInstagramAccounts.map((a) => a.username),
    unlinkedFacebookPages: unlinkedFacebookPages.map((p) => p.name),
    hint:
      facebookPages.length === 0
        ? "No Facebook Pages found. Run POST /api/meta/discover-pages to discover pages."
        : linkedPairs.length === 0
          ? "Pages found but none linked to Instagram. Check that pages have a linked Instagram Business/Creator account."
          : undefined,
  });
}
