import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { isAuthorizedOwnAccount } from "@/lib/ownAccountAuth";

/**
 * POST /api/meta/own-accounts
 *
 * Upserts a TrackedAccount as accountType=own for the current workspace.
 * Only allows accounts discoverable from active Meta OAuth connections or
 * linked Facebook Pages — rejects all other requests with 403.
 *
 * Body: { instagramUserId, username, connectionId?, displayName?, profilePictureUrl? }
 *
 * Safe to call multiple times on the same account (idempotent).
 * Does NOT create duplicates — finds existing by instagramUserId then username.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; name?: string | null };
  const workspace = await getOrCreateDefaultWorkspace(user.id, user.name);

  const body = await request.json() as {
    instagramUserId?: string;
    username?: string;
    connectionId?: string;
    displayName?: string | null;
    profilePictureUrl?: string | null;
  };

  const { instagramUserId, username, connectionId, displayName, profilePictureUrl } = body;

  if (!instagramUserId && !username) {
    return NextResponse.json(
      { error: "instagramUserId or username is required" },
      { status: 400 }
    );
  }

  // Must be discoverable from Meta OAuth assets
  const authorized = await isAuthorizedOwnAccount(workspace.id, {
    instagramUserId: instagramUserId ?? undefined,
    username: username ?? undefined,
  });
  if (!authorized) {
    return NextResponse.json(
      {
        error:
          "Own accounts must be selected from connected Meta assets. " +
          "Add public profiles as competitors instead.",
      },
      { status: 403 }
    );
  }

  // Resolve username: prefer the supplied value, fall back to connection record
  let resolvedUsername = username ?? null;
  if (!resolvedUsername && instagramUserId) {
    const conn = await db.instagramConnection.findFirst({
      where: { workspaceId: workspace.id, instagramUserId, status: "active" },
      select: { instagramUsername: true },
    });
    resolvedUsername = conn?.instagramUsername ?? null;
  }
  if (!resolvedUsername) {
    return NextResponse.json(
      { error: "Could not resolve Instagram username for this account" },
      { status: 400 }
    );
  }

  // Validate connectionId belongs to this workspace, if provided
  if (connectionId) {
    const conn = await db.instagramConnection.findFirst({
      where: { id: connectionId, workspaceId: workspace.id },
      select: { id: true },
    });
    if (!conn) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }
  }

  // Find existing TrackedAccount — by instagramUserId first, then by username
  let existing = instagramUserId
    ? await db.trackedAccount.findFirst({
        where: { workspaceId: workspace.id, instagramUserId },
      })
    : null;

  if (!existing) {
    existing = await db.trackedAccount.findFirst({
      where: { workspaceId: workspace.id, username: resolvedUsername },
    });
  }

  let account;
  if (existing) {
    // Update existing account to own — preserves all media, metrics, etc.
    account = await db.trackedAccount.update({
      where: { id: existing.id },
      data: {
        accountType: "own",
        ...(instagramUserId && { instagramUserId }),
        ...(displayName && { displayName }),
        ...(profilePictureUrl && { profilePictureUrl }),
        status: "active",
        isActive: true,
        updatedAt: new Date(),
      },
    });
  } else {
    account = await db.trackedAccount.create({
      data: {
        workspaceId: workspace.id,
        username: resolvedUsername,
        accountType: "own",
        instagramUserId: instagramUserId ?? null,
        displayName: displayName ?? null,
        profilePictureUrl: profilePictureUrl ?? null,
        status: "pending",
        isActive: true,
      },
    });
  }

  // Backfill connectionId separately — non-fatal if column missing
  if (connectionId) {
    try {
      await db.trackedAccount.update({
        where: { id: account.id },
        data: { connectionId },
      });
    } catch {
      // Column may be missing in some environments — safe to ignore
    }
  }

  console.log(
    `[own-accounts] userId=${user.id} workspaceId=${workspace.id} ` +
    `action=${existing ? "promoted" : "created"} username=${resolvedUsername}`
  );

  return NextResponse.json({ account, action: existing ? "promoted" : "created" }, { status: existing ? 200 : 201 });
}
