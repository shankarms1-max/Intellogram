import { db } from "@/lib/db";
import { decryptToken } from "@/lib/encryption";
import { getAccountProfile } from "./instagramApiClient";
import { extractHashtags, calcEngagementRate } from "@/lib/utils";
import { getRecentMedia, getMediaInsights } from "./instagramApiClient";

export async function syncOwnAccount(
  workspaceId: string,
  trackedAccountId: string
): Promise<{ success: boolean; error?: string; mediaCount?: number }> {
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

  const connection = account.instagramUserId
    ? await db.instagramConnection.findFirst({
        where: {
          workspaceId,
          instagramUserId: account.instagramUserId,
          status: "active",
        },
      })
    : null;

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
      insights = await getMediaInsights(workspaceId, item.id, item.media_type, accessToken);
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
