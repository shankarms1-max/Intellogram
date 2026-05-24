import { db } from "@/lib/db";
import { decryptToken, encryptToken } from "@/lib/encryption";
import {
  FacebookSyncMode,
  FB_SYNC_MODE_LIMITS,
  FacebookPost,
  discoverFacebookPages,
  fetchFacebookPagePosts,
  fetchFacebookPagePostsNextPage,
  getRateLimitLevel,
  isWorkspaceRateLimited,
} from "./facebookApiClient";

export type { FacebookSyncMode };

// ─── Page discovery & upsert ──────────────────────────────────────────────────

export interface DiscoveredPageResult {
  id: string;
  facebookPageId: string;
  name: string;
  category?: string | null;
  pictureUrl?: string | null;
  link?: string | null;
  fanCount?: number | null;
  followersCount?: number | null;
  linkedInstagramUsername?: string | null;
  linkedInstagramAccountId?: string | null;
  discoverySource: string;
  status: string;
}

/**
 * Discovers Facebook Pages for a workspace and upserts them into the DB.
 * Access tokens are encrypted before storage. Never exposed in return value.
 */
export async function discoverAndStorePages(
  workspaceId: string,
  accessToken: string
): Promise<{ pagesDiscovered: number; pages: DiscoveredPageResult[] }> {
  const rawPages = await discoverFacebookPages(workspaceId, accessToken);

  const stored: DiscoveredPageResult[] = [];
  for (const page of rawPages) {
    const encryptedToken = page.accessToken ? encryptToken(page.accessToken) : null;

    const upserted = await db.facebookPage.upsert({
      where: { workspaceId_facebookPageId: { workspaceId, facebookPageId: page.id } },
      update: {
        name: page.name,
        category: page.category ?? null,
        pictureUrl: page.pictureUrl ?? null,
        link: page.link ?? null,
        fanCount: page.fanCount ?? null,
        followersCount: page.followersCount ?? null,
        linkedInstagramAccountId: page.linkedInstagramAccountId ?? null,
        linkedInstagramUsername: page.linkedInstagramUsername ?? null,
        discoverySource: page.discoverySource,
        ...(encryptedToken ? { encryptedPageAccessToken: encryptedToken } : {}),
        status: "active",
      },
      create: {
        workspaceId,
        facebookPageId: page.id,
        name: page.name,
        category: page.category ?? null,
        pictureUrl: page.pictureUrl ?? null,
        link: page.link ?? null,
        fanCount: page.fanCount ?? null,
        followersCount: page.followersCount ?? null,
        encryptedPageAccessToken: encryptedToken,
        linkedInstagramAccountId: page.linkedInstagramAccountId ?? null,
        linkedInstagramUsername: page.linkedInstagramUsername ?? null,
        discoverySource: page.discoverySource,
        status: "active",
      },
    });

    stored.push({
      id: upserted.id,
      facebookPageId: upserted.facebookPageId,
      name: upserted.name,
      category: upserted.category,
      pictureUrl: upserted.pictureUrl,
      link: upserted.link,
      fanCount: upserted.fanCount,
      followersCount: upserted.followersCount,
      linkedInstagramUsername: upserted.linkedInstagramUsername,
      linkedInstagramAccountId: upserted.linkedInstagramAccountId,
      discoverySource: upserted.discoverySource ?? "standard_page_discovery",
      status: upserted.status,
    });
  }

  return { pagesDiscovered: stored.length, pages: stored };
}

// ─── Post upsert ──────────────────────────────────────────────────────────────

function mapPost(
  post: FacebookPost,
  workspaceId: string,
  pageDbId: string
) {
  const reactionsCount = post.reactions?.summary?.total_count ?? null;
  const commentsCount = post.comments?.summary?.total_count ?? null;
  const sharesCount = post.shares?.count ?? null;
  const engagementCount =
    (reactionsCount ?? 0) + (commentsCount ?? 0) + (sharesCount ?? 0) || null;

  const attachment = post.attachments?.data?.[0];

  return {
    workspaceId,
    pageDbId,
    facebookPostId: post.id,
    message: post.message ?? null,
    story: post.story ?? null,
    createdTime: new Date(post.created_time),
    permalinkUrl: post.permalink_url ?? null,
    fullPicture: post.full_picture ?? null,
    attachmentType: attachment?.type ?? null,
    attachmentUrl: attachment?.url ?? attachment?.media?.image?.src ?? null,
    reactionsCount,
    commentsCount,
    sharesCount,
    engagementCount,
    fetchedAt: new Date(),
  };
}

async function upsertPost(
  post: FacebookPost,
  workspaceId: string,
  pageDbId: string
): Promise<void> {
  const data = mapPost(post, workspaceId, pageDbId);
  await db.facebookPagePost.upsert({
    where: { workspaceId_facebookPostId: { workspaceId, facebookPostId: post.id } },
    update: {
      message: data.message,
      story: data.story,
      permalinkUrl: data.permalinkUrl,
      fullPicture: data.fullPicture,
      attachmentType: data.attachmentType,
      attachmentUrl: data.attachmentUrl,
      reactionsCount: data.reactionsCount,
      commentsCount: data.commentsCount,
      sharesCount: data.sharesCount,
      engagementCount: data.engagementCount,
      fetchedAt: data.fetchedAt,
    },
    create: data,
  });
}

// ─── Page post sync ───────────────────────────────────────────────────────────

export interface PageSyncResult {
  success: boolean;
  status?: string;
  error?: string;
  platform: "facebook";
  syncMode?: FacebookSyncMode;
  requestedLimit?: number;
  fetchedPostCount?: number;
  upsertedPostCount?: number;
  pagesFetched?: number;
  oldestFetchedTimestamp?: string | null;
  newestFetchedTimestamp?: string | null;
  stoppedReason?: string;
}

/**
 * Syncs posts for a Facebook Page.
 * Uses the page's stored access token (decrypted on use; never logged).
 */
export async function syncFacebookPagePosts(
  workspaceId: string,
  pageDbId: string,
  syncMode: FacebookSyncMode = "daily_refresh"
): Promise<PageSyncResult> {
  const page = await db.facebookPage.findFirst({
    where: { id: pageDbId, workspaceId },
  });

  if (!page) {
    return { success: false, error: "Facebook Page not found", platform: "facebook" };
  }

  if (!page.encryptedPageAccessToken) {
    return {
      success: false,
      status: "no_page_token",
      error: "No page access token stored. Re-run page discovery to refresh tokens.",
      platform: "facebook",
      stoppedReason: "no_page_token",
    };
  }

  let pageAccessToken: string;
  try {
    pageAccessToken = decryptToken(page.encryptedPageAccessToken);
  } catch {
    return {
      success: false,
      error: "Failed to decrypt page access token. Re-run page discovery.",
      platform: "facebook",
      stoppedReason: "no_page_token",
    };
  }

  const { postLimit, maxPages } = FB_SYNC_MODE_LIMITS[syncMode];

  const job = await db.syncJob.create({
    data: {
      workspaceId,
      jobType: "facebook_page_sync",
      status: "running",
      startedAt: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata: { pageDbId, facebookPageId: page.facebookPageId, pageName: page.name, syncMode, requestedLimit: postLimit } as any,
    },
  });

  // ─── Collect posts across pages ───────────────────────────────────────────

  const allPosts: FacebookPost[] = [];
  let pagesFetched = 0;
  let stoppedReason = "max_pages_reached";

  const firstPage = await fetchFacebookPagePosts(workspaceId, page.facebookPageId, pageAccessToken, 25);
  pagesFetched = 1;

  if (firstPage.error) {
    await db.syncJob.update({
      where: { id: job.id },
      data: { status: "failed", completedAt: new Date(), errorMessage: firstPage.error },
    });
    return { success: false, error: firstPage.error, platform: "facebook", stoppedReason: "meta_error" };
  }

  allPosts.push(...firstPage.posts);
  let nextCursor = firstPage.nextCursor;

  if (!nextCursor || allPosts.length >= postLimit) {
    stoppedReason = allPosts.length >= postLimit ? "max_limit_reached" : "no_more_pages";
  } else if (maxPages <= 1) {
    stoppedReason = "max_pages_reached";
  } else {
    while (nextCursor && allPosts.length < postLimit && pagesFetched < maxPages) {
      const rateLimited = await isWorkspaceRateLimited(workspaceId);
      if (rateLimited) { stoppedReason = "rate_limit_high"; break; }

      const pageResult = await fetchFacebookPagePostsNextPage(
        workspaceId, page.facebookPageId, pageAccessToken, nextCursor, 25
      );

      if (pageResult.error) { stoppedReason = "meta_error"; break; }

      if (pageResult.rateLimitInfo) {
        const level = getRateLimitLevel(pageResult.rateLimitInfo);
        if (level === "pause" || level === "stop") { stoppedReason = "rate_limit_high"; break; }
      }

      allPosts.push(...pageResult.posts);
      pagesFetched++;
      nextCursor = pageResult.nextCursor;

      if (!nextCursor) { stoppedReason = "no_more_pages"; break; }
      if (allPosts.length >= postLimit) { stoppedReason = "max_limit_reached"; break; }
    }
  }

  // ─── Upsert collected posts ───────────────────────────────────────────────

  const postsToStore = allPosts.slice(0, postLimit);
  for (const post of postsToStore) {
    await upsertPost(post, workspaceId, pageDbId);
  }

  const timestamps = postsToStore
    .map((p) => new Date(p.created_time).getTime())
    .filter((t) => !isNaN(t));
  const oldestFetchedTimestamp = timestamps.length ? new Date(Math.min(...timestamps)).toISOString() : null;
  const newestFetchedTimestamp = timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;

  await db.facebookPage.update({
    where: { id: pageDbId },
    data: { lastSyncedAt: new Date(), status: "active" },
  });

  const syncSummary = {
    pageDbId,
    facebookPageId: page.facebookPageId,
    pageName: page.name,
    platform: "facebook",
    syncMode,
    requestedLimit: postLimit,
    fetchedPostCount: allPosts.length,
    upsertedPostCount: postsToStore.length,
    pagesFetched,
    oldestFetchedTimestamp,
    newestFetchedTimestamp,
    stoppedReason,
  };

  console.log("[FacebookPageSync][summary]", JSON.stringify(syncSummary));

  await db.syncJob.update({
    where: { id: job.id },
    data: {
      status: "completed",
      completedAt: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata: syncSummary as any,
    },
  });

  return {
    success: true,
    platform: "facebook",
    syncMode,
    requestedLimit: postLimit,
    fetchedPostCount: allPosts.length,
    upsertedPostCount: postsToStore.length,
    pagesFetched,
    oldestFetchedTimestamp,
    newestFetchedTimestamp,
    stoppedReason,
  };
}
