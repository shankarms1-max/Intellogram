import { safeApiCall, getRateLimitLevel, isWorkspaceRateLimited } from "./instagramApiClient";

const GRAPH_API_VERSION = process.env.INSTAGRAM_GRAPH_API_VERSION || "v21.0";
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// ─── Sync mode configuration ──────────────────────────────────────────────────

export type FacebookSyncMode = "daily_refresh" | "initial_import" | "manual_deep_import";

export const FB_SYNC_MODE_LIMITS: Record<FacebookSyncMode, { postLimit: number; maxPages: number }> = {
  daily_refresh:      { postLimit: 25,  maxPages: 1  },
  initial_import:     { postLimit: 100, maxPages: 4  },
  manual_deep_import: { postLimit: 500, maxPages: 20 },
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FacebookPageInfo {
  id: string;
  name: string;
  category?: string;
  pictureUrl?: string;
  link?: string;
  fanCount?: number;
  followersCount?: number;
  accessToken?: string;
  linkedInstagramAccountId?: string;
  linkedInstagramUsername?: string;
  discoverySource: "standard_page_discovery" | "business_manager_owned_pages" | "business_manager_client_pages";
}

export interface RawFacebookPage {
  id: string;
  name: string;
  category?: string;
  access_token?: string;
  picture?: { data?: { url?: string } };
  link?: string;
  fan_count?: number;
  followers_count?: number;
  instagram_business_account?: { id: string; username?: string };
  connected_instagram_account?: { id: string; username?: string };
}

export interface FacebookPost {
  id: string;
  message?: string;
  story?: string;
  created_time: string;
  permalink_url?: string;
  full_picture?: string;
  attachments?: {
    data?: Array<{ type?: string; url?: string; media?: { image?: { src?: string } } }>;
  };
  reactions?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
  shares?: { count?: number };
}

export interface FacebookPostPageResult {
  posts: FacebookPost[];
  nextCursor: string | null;
  error: string | null;
  rateLimitInfo?: Record<string, unknown>;
}

// ─── Page discovery ───────────────────────────────────────────────────────────

const PAGE_FIELDS =
  "id,name,category,access_token,picture{url},link,fan_count,followers_count,instagram_business_account{id,username},connected_instagram_account{id,username}";

function mapRawPage(
  page: RawFacebookPage,
  source: FacebookPageInfo["discoverySource"]
): FacebookPageInfo {
  const ig = page.instagram_business_account ?? page.connected_instagram_account;
  return {
    id: page.id,
    name: page.name,
    category: page.category,
    pictureUrl: page.picture?.data?.url,
    link: page.link,
    fanCount: page.fan_count,
    followersCount: page.followers_count,
    accessToken: page.access_token,
    linkedInstagramAccountId: ig?.id,
    linkedInstagramUsername: ig?.username,
    discoverySource: source,
  };
}

/**
 * Discovers all Facebook Pages accessible via the user's token.
 * Tries /me/accounts first, then Business Manager fallback.
 * Returns pages with metadata but strips access tokens before returning to callers.
 * Access tokens are available internally for storage.
 */
export async function discoverFacebookPages(
  workspaceId: string,
  accessToken: string
): Promise<FacebookPageInfo[]> {
  const pages: FacebookPageInfo[] = [];
  const seenIds = new Set<string>();

  const addPages = (raw: RawFacebookPage[], source: FacebookPageInfo["discoverySource"]) => {
    for (const p of raw) {
      if (seenIds.has(p.id)) continue;
      seenIds.add(p.id);
      pages.push(mapRawPage(p, source));
    }
  };

  // Strategy 1: /me/accounts (standard — classic pages)
  const accountsResult = await safeApiCall<{ data: RawFacebookPage[] }>(
    workspaceId,
    `${BASE_URL}/me/accounts?fields=${PAGE_FIELDS}&access_token=${encodeURIComponent(accessToken)}`
  );
  const classicPages = accountsResult.data?.data ?? [];
  console.log(`[FacebookPageDiscovery] /me/accounts returned ${classicPages.length} pages`);
  addPages(classicPages, "standard_page_discovery");

  // Strategy 2: Business Manager owned pages
  if (pages.length === 0) {
    const bizResult = await safeApiCall<{ data: Array<{ id: string; name: string }> }>(
      workspaceId,
      `${BASE_URL}/me/businesses?fields=id,name&access_token=${encodeURIComponent(accessToken)}`
    );
    const businesses = bizResult.data?.data ?? [];
    console.log(`[FacebookPageDiscovery] /me/businesses returned ${businesses.length} businesses`);

    for (const biz of businesses) {
      const ownedResult = await safeApiCall<{ data: RawFacebookPage[] }>(
        workspaceId,
        `${BASE_URL}/${biz.id}/owned_pages?fields=${PAGE_FIELDS}&access_token=${encodeURIComponent(accessToken)}`
      );
      const owned = ownedResult.data?.data ?? [];
      addPages(owned, "business_manager_owned_pages");

      const clientResult = await safeApiCall<{ data: RawFacebookPage[] }>(
        workspaceId,
        `${BASE_URL}/${biz.id}/client_pages?fields=${PAGE_FIELDS}&access_token=${encodeURIComponent(accessToken)}`
      );
      const client = clientResult.data?.data ?? [];
      addPages(client, "business_manager_client_pages");

      if (pages.length > 0) break;
    }
  }

  if (pages.length === 0) {
    console.log("[FacebookPageDiscovery] No Facebook Pages found. Ensure pages_show_list permission is granted.");
  }

  return pages;
}

// ─── Post fetching ────────────────────────────────────────────────────────────

const POST_FIELDS =
  "id,message,story,created_time,permalink_url,full_picture,attachments{type,url,media},reactions.summary(true).limit(0),comments.summary(true).limit(0),shares";

/**
 * Fetches the first page of posts for a Facebook Page using the Page access token.
 */
export async function fetchFacebookPagePosts(
  workspaceId: string,
  facebookPageId: string,
  pageAccessToken: string,
  limit = 25
): Promise<FacebookPostPageResult> {
  const cappedLimit = Math.min(limit, 100);
  const params = new URLSearchParams();
  params.set("fields", POST_FIELDS);
  params.set("limit", String(cappedLimit));
  params.set("access_token", pageAccessToken);
  const url = `${BASE_URL}/${facebookPageId}/posts?${params.toString()}`;

  const result = await safeApiCall<{
    data: FacebookPost[];
    paging?: { cursors?: { after?: string }; next?: string };
  }>(workspaceId, url);

  if (result.error || !result.data) {
    return { posts: [], nextCursor: null, error: result.error, rateLimitInfo: result.rateLimitInfo };
  }

  const nextCursor = result.data.paging?.cursors?.after ?? null;
  return {
    posts: result.data.data ?? [],
    nextCursor,
    error: null,
    rateLimitInfo: result.rateLimitInfo,
  };
}

/**
 * Fetches a subsequent page of Facebook Page posts using a cursor.
 */
export async function fetchFacebookPagePostsNextPage(
  workspaceId: string,
  facebookPageId: string,
  pageAccessToken: string,
  afterCursor: string,
  limit = 25
): Promise<FacebookPostPageResult> {
  const cappedLimit = Math.min(limit, 100);
  const params = new URLSearchParams();
  params.set("fields", POST_FIELDS);
  params.set("limit", String(cappedLimit));
  params.set("after", afterCursor);
  params.set("access_token", pageAccessToken);
  const url = `${BASE_URL}/${facebookPageId}/posts?${params.toString()}`;

  const result = await safeApiCall<{
    data: FacebookPost[];
    paging?: { cursors?: { after?: string }; next?: string };
  }>(workspaceId, url);

  if (result.error || !result.data) {
    return { posts: [], nextCursor: null, error: result.error, rateLimitInfo: result.rateLimitInfo };
  }

  const nextCursor = result.data.paging?.cursors?.after ?? null;
  return {
    posts: result.data.data ?? [],
    nextCursor,
    error: null,
    rateLimitInfo: result.rateLimitInfo,
  };
}

// Re-export shared utilities for use in sync service
export { getRateLimitLevel, isWorkspaceRateLimited };
