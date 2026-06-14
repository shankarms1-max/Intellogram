import {
  exchangeCodeForToken,
  getLongLivedToken,
  getConnectedInstagramAccounts,
  validateAccessToken,
} from "./instagramApiClient";
import { encryptToken } from "@/lib/encryption";
import { db } from "@/lib/db";

export function buildOAuthUrl(
  state: string,
  appId: string,
  redirectUri: string
): string {
  const scopeList = [
    "instagram_basic",
    "instagram_manage_insights",
    "pages_read_engagement",
    "pages_show_list",
  ];

  // Optional Business Manager fallback — adds business_management scope so
  // /me/businesses can resolve Pages managed through Meta Business Portfolio.
  // Enable by setting META_ENABLE_BUSINESS_MANAGER_FALLBACK=true in env.
  if (process.env.META_ENABLE_BUSINESS_MANAGER_FALLBACK === "true") {
    scopeList.push("business_management");
  }

  const scopes = scopeList.join(",");

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: scopes,
    response_type: "code",
    state,
  });

  return `https://www.facebook.com/dialog/oauth?${params.toString()}`;
}

export async function handleOAuthCallback(
  workspaceId: string,
  userId: string,
  code: string,
  appId: string,
  appSecret: string,
  redirectUri: string
): Promise<{ success: boolean; error?: string; accountsConnected?: number }> {
  const shortToken = await exchangeCodeForToken(code, redirectUri, appId, appSecret);
  if (!shortToken) {
    return { success: false, error: "Failed to exchange authorization code for access token" };
  }

  const longToken = await getLongLivedToken(shortToken.accessToken, appId, appSecret);
  if (!longToken) {
    return { success: false, error: "Failed to upgrade to a long-lived access token" };
  }

  const igAccounts = await getConnectedInstagramAccounts(workspaceId, longToken.accessToken);

  if (igAccounts.length === 0) {
    return {
      success: false,
      error:
        "No Instagram Business or Creator accounts found. " +
        "Make sure your Instagram account is a Business or Creator account connected to a Facebook Page.",
    };
  }

  // Get real granted scopes and expiry from the token
  const validation = await validateAccessToken(longToken.accessToken, appId, appSecret);
  const grantedScopes = validation.valid && validation.scopes.length > 0
    ? validation.scopes
    : ["instagram_basic", "instagram_manage_insights", "pages_read_engagement", "pages_show_list"];

  const expiresAt = validation.expiresAt ?? new Date(Date.now() + longToken.expiresIn * 1000);
  const encryptedToken = encryptToken(longToken.accessToken);

  // When exactly one account is discovered, auto-add as own (backward compat for
  // personal/single-brand workspaces). When multiple are discovered, store the
  // OAuth connection so tokens are available, but let the user choose which
  // accounts to track as own via /dashboard/own-accounts → Add as Own.
  const autoAddAsOwn = igAccounts.length === 1;
  let connected = 0;

  for (const account of igAccounts) {
    // ── Step 1: Always upsert the OAuth connection — token must be stored ──────
    const connection = await db.instagramConnection.upsert({
      where: {
        workspaceId_instagramUserId: { workspaceId, instagramUserId: account.id },
      },
      update: {
        accessTokenEncrypted: encryptedToken,
        tokenExpiresAt: expiresAt,
        status: "active",
        instagramUsername: account.username,
        scopes: grantedScopes,
        updatedAt: new Date(),
      },
      create: {
        workspaceId,
        userId,
        instagramUserId: account.id,
        instagramUsername: account.username,
        accessTokenEncrypted: encryptedToken,
        tokenExpiresAt: expiresAt,
        scopes: grantedScopes,
        status: "active",
      },
    });

    if (autoAddAsOwn) {
      // ── Single account: existing auto-add-as-own behavior ───────────────────
      const trackedAccount = await db.trackedAccount.upsert({
        where: { workspaceId_username: { workspaceId, username: account.username } },
        update: {
          instagramUserId: account.id,
          displayName: account.name,
          profilePictureUrl: account.profile_picture_url,
          biography: account.biography,
          website: account.website,
          followersCount: account.followers_count,
          followsCount: account.follows_count,
          mediaCount: account.media_count,
          status: "active",
          accountType: "own",
          updatedAt: new Date(),
        },
        create: {
          workspaceId,
          instagramUserId: account.id,
          username: account.username,
          displayName: account.name,
          profilePictureUrl: account.profile_picture_url,
          biography: account.biography,
          website: account.website,
          followersCount: account.followers_count,
          followsCount: account.follows_count,
          mediaCount: account.media_count,
          accountType: "own",
          status: "active",
        },
      });

      // Backfill connectionId on the upserted row.
      try {
        await db.trackedAccount.update({
          where: { id: trackedAccount.id },
          data: { connectionId: connection.id },
        });
      } catch {
        // Column not yet migrated in this environment — safe to ignore.
      }

      // Backfill connectionId on other own rows with the same instagramUserId
      // (covers accounts whose username changed since first tracking).
      try {
        await db.trackedAccount.updateMany({
          where: {
            workspaceId,
            instagramUserId: account.id,
            accountType: "own",
            connectionId: null,
            NOT: { id: trackedAccount.id },
          },
          data: { connectionId: connection.id },
        });
      } catch {
        // Safe to ignore — backfill only.
      }
    } else {
      // ── Multiple accounts: do NOT auto-create own TrackedAccounts ────────────
      // Only refresh profile data + connectionId for accounts already tracked as own.
      // New accounts stay untracked; user picks them via "Add as Own" in the UI.
      const existingOwn = await db.trackedAccount.findFirst({
        where: {
          workspaceId,
          accountType: "own",
          OR: [
            { instagramUserId: account.id },
            { username: account.username },
          ],
        },
        select: { id: true },
      });

      if (existingOwn) {
        await db.trackedAccount.update({
          where: { id: existingOwn.id },
          data: {
            instagramUserId: account.id,
            displayName: account.name,
            profilePictureUrl: account.profile_picture_url,
            biography: account.biography,
            website: account.website,
            followersCount: account.followers_count,
            followsCount: account.follows_count,
            mediaCount: account.media_count,
            status: "active",
            updatedAt: new Date(),
          },
        });

        try {
          await db.trackedAccount.update({
            where: { id: existingOwn.id },
            data: { connectionId: connection.id },
          });
        } catch {
          // Safe to ignore.
        }
      }
      // No existing own account → leave untracked; "Add as Own" will create it.
    }

    connected++;
  }

  return { success: true, accountsConnected: connected };
}

export async function disconnectInstagram(
  workspaceId: string,
  instagramUserId: string
): Promise<void> {
  await db.instagramConnection.updateMany({
    where: { workspaceId, instagramUserId },
    data: { status: "disconnected" },
  });
}
