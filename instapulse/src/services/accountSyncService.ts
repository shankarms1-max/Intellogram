import { db } from "@/lib/db";
import { decryptToken } from "@/lib/encryption";
import { getAccountProfile, getCompetitorPublicProfile, getOwnInstagramBusinessAccountId, normalizeInstagramUsername } from "./instagramApiClient";
import { extractHashtags, calcEngagementRate } from "@/lib/utils";
import { getRecentMedia, getMediaInsights } from "./instagramApiClient";

export async function syncOwnAccount(
  workspaceId: string,
  trackedAccountId: string
): Promise<{ success: boolean; status?: string; error?: string; mediaCount?: number }> {
  const account = await db.trackedAccount.findUnique({
    where: { id: trackedAccountId },
  });

  if (!account) return { success: false, error: "Account not found" };
  if (account.workspaceId !== workspaceId) {
    return { success: false, error: "Account does not belong to this workspace" };
  }

  // Create a per-account SyncJob record
  const job = await db.syncJob.create({
    data: {
      workspaceId,
      jobType: "account_sync",
      status: "running",
      startedAt: new Date(),
      metadata: { trackedAccountId, username: account.username },
    },
  });

  let connection = account.instagramUserId
    ? await db.instagramConnection.findFirst({
        where: { workspaceId, instagramUserId: account.instagramUserId, status: "active" },
      })
    : null;

  // Fallback: if lookup by instagramUserId failed (e.g. stale Facebook user ID stored),
  // try any active connection in the workspace.
  if (!connection) {
    connection = await db.instagramConnection.findFirst({
      where: { workspaceId, status: "active" },
      orderBy: { updatedAt: "desc" },
    });
    if (connection) {
      console.log(`[syncOwnAccount] Using fallback active connection ${connection.instagramUserId} for account ${account.username}`);
    }
  }

  if (!connection) {
    await db.trackedAccount.update({
      where: { id: trackedAccountId },
      data: { status: "unavailable" },
    });
    await db.syncJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        completedAt: new Date(),
        errorMessage: "No active Instagram connection found",
      },
    });
    return { success: false, error: "No active Instagram connection found" };
  }

  let accessToken: string;
  try {
    accessToken = decryptToken(connection.accessTokenEncrypted);
  } catch {
    await db.syncJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        completedAt: new Date(),
        errorMessage: "Failed to decrypt access token",
      },
    });
    return { success: false, error: "Failed to decrypt access token" };
  }

  const profile = await getAccountProfile(workspaceId, account.instagramUserId!, accessToken);

  if (profile) {
    await db.trackedAccount.update({
      where: { id: trackedAccountId },
      data: {
        displayName: profile.name,
        profilePictureUrl: profile.profile_picture_url,
        biography: profile.biography,
        website: profile.website,
        followersCount: profile.followers_count,
        followsCount: profile.follows_count,
        mediaCount: profile.media_count,
        status: "active",
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await db.accountSnapshot.upsert({
      where: {
        trackedAccountId_snapshotDate: {
          trackedAccountId,
          snapshotDate: today,
        },
      },
      update: {
        followersCount: profile.followers_count,
        followsCount: profile.follows_count,
        mediaCount: profile.media_count,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rawJson: profile as any,
      },
      create: {
        workspaceId,
        trackedAccountId,
        snapshotDate: today,
        followersCount: profile.followers_count,
        followsCount: profile.follows_count,
        mediaCount: profile.media_count,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rawJson: profile as any,
      },
    });
  }

  const mediaItems = await getRecentMedia(
    workspaceId,
    account.instagramUserId!,
    accessToken,
    account.fetchLimit
  );

  let synced = 0;

  for (const item of mediaItems) {
    let insights = {};
    try {
      insights = await getMediaInsights(workspaceId, item.id, item.media_type, item.media_product_type, accessToken);
    } catch {
      // insights not available for all media types — stored as null
    }

    const ins = insights as {
      video_views?: number; plays?: number; reach?: number;
      impressions?: number; saved?: number; shares?: number;
    };
    const engRate = calcEngagementRate(
      item.like_count ?? null,
      item.comments_count ?? null,
      profile?.followers_count ?? null
    );

    const hashtags = extractHashtags(item.caption);

    await db.mediaItem.upsert({
      where: {
        trackedAccountId_instagramMediaId: {
          trackedAccountId,
          instagramMediaId: item.id,
        },
      },
      update: {
        likeCount: item.like_count ?? null,
        commentsCount: item.comments_count ?? null,
        viewsCount: ins.video_views ?? null,
        playsCount: ins.plays ?? null,
        reach: ins.reach ?? null,
        impressions: ins.impressions ?? null,
        saved: ins.saved ?? null,
        shares: ins.shares ?? null,
        engagementRate: engRate,
        fetchedAt: new Date(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rawJson: { ...item, ...ins } as any,
      },
      create: {
        workspaceId,
        trackedAccountId,
        instagramMediaId: item.id,
        mediaType: item.media_type,
        mediaProductType: item.media_product_type ?? null,
        caption: item.caption ?? null,
        permalink: item.permalink ?? null,
        thumbnailUrl: item.thumbnail_url ?? null,
        mediaUrl: item.media_url ?? null,
        timestamp: new Date(item.timestamp),
        likeCount: item.like_count ?? null,
        commentsCount: item.comments_count ?? null,
        viewsCount: ins.video_views ?? null,
        playsCount: ins.plays ?? null,
        reach: ins.reach ?? null,
        impressions: ins.impressions ?? null,
        saved: ins.saved ?? null,
        shares: ins.shares ?? null,
        engagementRate: engRate,
        hashtags,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rawJson: { ...item, ...ins } as any,
      },
    });

    synced++;
  }

  await db.trackedAccount.update({
    where: { id: trackedAccountId },
    data: { lastSyncedAt: new Date() },
  });

  await db.syncJob.update({
    where: { id: job.id },
    data: {
      status: "completed",
      completedAt: new Date(),
      metadata: { trackedAccountId, username: account.username, mediaCount: synced },
    },
  });

  return { success: true, mediaCount: synced };
}

/** Resolves a workspace access token from either InstagramConnection or WorkspaceCredential (byok_token). */
async function resolveWorkspaceAccessToken(workspaceId: string): Promise<string | null> {
  // Prefer an active OAuth connection
  const conn = await db.instagramConnection.findFirst({
    where: { workspaceId, status: "active" },
    orderBy: { updatedAt: "desc" },
  });
  if (conn) {
    try { return decryptToken(conn.accessTokenEncrypted); } catch { /* fall through */ }
  }
  // Fall back to BYOK token credential
  const cred = await db.workspaceCredential.findUnique({ where: { workspaceId } });
  if (cred?.mode === "byok_token" && cred.accessTokenEncrypted) {
    try { return decryptToken(cred.accessTokenEncrypted); } catch { /* fall through */ }
  }
  return null;
}

export async function syncCompetitorAccount(
  workspaceId: string,
  trackedAccountId: string
): Promise<{ success: boolean; status?: string; error?: string; mediaCount?: number }> {
  const account = await db.trackedAccount.findUnique({ where: { id: trackedAccountId } });
  if (!account) return { success: false, error: "Account not found" };
  if (account.workspaceId !== workspaceId) return { success: false, error: "Account does not belong to this workspace" };

  const job = await db.syncJob.create({
    data: {
      workspaceId,
      jobType: "competitor_sync",
      status: "running",
      startedAt: new Date(),
      metadata: { trackedAccountId, username: account.username },
    },
  });

  const accessToken = await resolveWorkspaceAccessToken(workspaceId);
  if (!accessToken) {
    await db.syncJob.update({
      where: { id: job.id },
      data: { status: "failed", completedAt: new Date(), errorMessage: "No active access token found. Connect your Instagram account first." },
    });
    return { success: false, error: "No active access token found. Connect your Instagram account first." };
  }

  // Get our own IG Business Account ID (required for Business Discovery API)
  const ownIgUserId = await getOwnInstagramBusinessAccountId(workspaceId, accessToken);
  if (!ownIgUserId) {
    await db.syncJob.update({
      where: { id: job.id },
      data: { status: "failed", completedAt: new Date(), errorMessage: "Could not find a connected Instagram Business/Creator account. Business Discovery API requires your own account to be connected." },
    });
    return { success: false, error: "Could not find a connected Instagram Business/Creator account." };
  }

  const normalizedUsername = normalizeInstagramUsername(account.username) ?? account.username;
  const { profile, errorStatus, errorMessage: discoveryErrorMessage } = await getCompetitorPublicProfile(workspaceId, ownIgUserId, normalizedUsername, accessToken, account.fetchLimit);
  if (!profile) {
    if (errorStatus === "requires_live_mode_or_tester") {
      const msg = "Business Discovery is restricted while the Meta app is in Development mode. Test with app tester accounts or switch to Live mode after App Review.";
      await db.syncJob.update({
        where: { id: job.id },
        data: {
          status: "failed",
          completedAt: new Date(),
          errorMessage: msg,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          metadata: { trackedAccountId, username: account.username, businessDiscoveryStatus: "requires_live_mode_or_tester" } as any,
        },
      });
      return { success: false, status: "requires_live_mode_or_tester", error: msg };
    }

    if (errorStatus === "invalid_username" || errorStatus === "invalid_username_or_query_builder_error") {
      const msg = discoveryErrorMessage ?? `Invalid username: @${account.username}. Check the username and try again.`;
      await db.syncJob.update({
        where: { id: job.id },
        data: {
          status: "failed",
          completedAt: new Date(),
          errorMessage: msg,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          metadata: { trackedAccountId, username: account.username, businessDiscoveryStatus: errorStatus } as any,
        },
      });
      // Do not mark account as unavailable — the username may just need correcting
      return { success: false, status: errorStatus, error: msg };
    }

    const msg = discoveryErrorMessage ?? `Could not fetch public profile for @${account.username}. Account may be private, personal (non-Business/Creator), or username may be wrong.`;
    await db.syncJob.update({
      where: { id: job.id },
      data: { status: "failed", completedAt: new Date(), errorMessage: msg },
    });
    await db.trackedAccount.update({ where: { id: trackedAccountId }, data: { status: "unavailable" } });
    return { success: false, error: `Could not fetch public profile for @${account.username}. The account must be a public Business or Creator account.` };
  }

  // Update tracked account with public profile data
  await db.trackedAccount.update({
    where: { id: trackedAccountId },
    data: {
      displayName: profile.name ?? null,
      profilePictureUrl: profile.profile_picture_url ?? null,
      biography: profile.biography ?? null,
      website: profile.website ?? null,
      followersCount: profile.followers_count ?? null,
      mediaCount: profile.media_count ?? null,
      instagramUserId: profile.id,
      status: "active",
      lastSyncedAt: new Date(),
    },
  });

  // Save daily snapshot (followers only — no private insights for competitors)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  await db.accountSnapshot.upsert({
    where: { trackedAccountId_snapshotDate: { trackedAccountId, snapshotDate: today } },
    update: { followersCount: profile.followers_count ?? null, mediaCount: profile.media_count ?? null },
    create: {
      workspaceId,
      trackedAccountId,
      snapshotDate: today,
      followersCount: profile.followers_count ?? null,
      mediaCount: profile.media_count ?? null,
    },
  });

  // Upsert public media items (no insights — reach/impressions/saves not available)
  let synced = 0;
  for (const item of profile.media?.data ?? []) {
    const engRate = calcEngagementRate(
      item.like_count ?? null,
      item.comments_count ?? null,
      profile.followers_count ?? null
    );
    await db.mediaItem.upsert({
      where: { trackedAccountId_instagramMediaId: { trackedAccountId, instagramMediaId: item.id } },
      update: {
        likeCount: item.like_count ?? null,
        commentsCount: item.comments_count ?? null,
        engagementRate: engRate,
        fetchedAt: new Date(),
      },
      create: {
        workspaceId,
        trackedAccountId,
        instagramMediaId: item.id,
        mediaType: item.media_type,
        caption: item.caption ?? null,
        permalink: item.permalink ?? null,
        thumbnailUrl: item.thumbnail_url ?? null,
        timestamp: new Date(item.timestamp),
        likeCount: item.like_count ?? null,
        commentsCount: item.comments_count ?? null,
        engagementRate: engRate,
        hashtags: extractHashtags(item.caption),
        // reach/impressions/saves/shares are null — not available via Business Discovery
      },
    });
    synced++;
  }

  await db.syncJob.update({
    where: { id: job.id },
    data: {
      status: "completed",
      completedAt: new Date(),
      metadata: { trackedAccountId, username: account.username, mediaCount: synced },
    },
  });

  return { success: true, mediaCount: synced };
}

export async function syncWorkspace(workspaceId: string): Promise<{
  total: number;
  succeeded: number;
  failed: number;
}> {
  const accounts = await db.trackedAccount.findMany({
    where: { workspaceId, isActive: true, accountType: "own" },
  });

  const job = await db.syncJob.create({
    data: {
      workspaceId,
      jobType: "workspace_sync",
      status: "running",
      startedAt: new Date(),
      metadata: { total: accounts.length },
    },
  });

  let succeeded = 0;
  let failed = 0;

  for (const account of accounts) {
    const result = await syncOwnAccount(workspaceId, account.id);
    if (result.success) succeeded++;
    else failed++;
  }

  await db.syncJob.update({
    where: { id: job.id },
    data: {
      status: failed === accounts.length && accounts.length > 0 ? "failed" : "completed",
      completedAt: new Date(),
      metadata: { total: accounts.length, succeeded, failed },
    },
  });

  return { total: accounts.length, succeeded, failed };
}
