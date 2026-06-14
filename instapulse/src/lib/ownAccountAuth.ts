import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Verify that a username or instagramUserId is discoverable through an active
 * Meta OAuth connection for this workspace.
 *
 * An account is authorized as "own" if any of the following exist in this workspace:
 *   A. An active InstagramConnection with a matching instagramUserId or instagramUsername
 *   B. A FacebookPage with a matching linkedInstagramAccountId or linkedInstagramUsername
 *
 * Returns true when authorized, false otherwise.
 * Never throws — callers should treat an exception as unauthorized.
 */
export async function isAuthorizedOwnAccount(
  workspaceId: string,
  opts: { username?: string; instagramUserId?: string }
): Promise<boolean> {
  const { username, instagramUserId } = opts;
  if (!username && !instagramUserId) return false;

  try {
    // Check InstagramConnection
    const connOr: Prisma.InstagramConnectionWhereInput[] = [];
    if (instagramUserId) connOr.push({ workspaceId, instagramUserId, status: "active" });
    if (username) connOr.push({ workspaceId, instagramUsername: username, status: "active" });

    if (connOr.length > 0) {
      const conn = await db.instagramConnection.findFirst({
        where: { OR: connOr },
        select: { id: true },
      });
      if (conn) return true;
    }

    // Check FacebookPage (linked IG account)
    const pageOr: Prisma.FacebookPageWhereInput[] = [];
    if (instagramUserId) pageOr.push({ workspaceId, linkedInstagramAccountId: instagramUserId });
    if (username) pageOr.push({ workspaceId, linkedInstagramUsername: username });

    if (pageOr.length > 0) {
      const page = await db.facebookPage.findFirst({
        where: { OR: pageOr },
        select: { id: true },
      });
      if (page) return true;
    }
  } catch {
    // Treat DB errors as unauthorized
  }

  return false;
}
