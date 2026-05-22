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
  const scopes = [
    "instagram_basic",
    "instagram_manage_insights",
    "pages_read_engagement",
    "pages_show_list",
  ].join(",");

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

  let connected = 0;

  for (const account of igAccounts) {
    await db.instagramConnection.upsert({
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

    await db.trackedAccount.upsert({
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
