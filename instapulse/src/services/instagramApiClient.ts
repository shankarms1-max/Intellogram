import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { normalizeInstagramUsername as _normalizeInstagramUsername } from "@/lib/instagramUtils";
export { normalizeInstagramUsername } from "@/lib/instagramUtils";

const GRAPH_API_VERSION = process.env.INSTAGRAM_GRAPH_API_VERSION || "v21.0";
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// ─── Rate-limit thresholds ────────────────────────────────────────────────────

export type RateLimitLevel = "ok" | "warn" | "pause" | "stop";

export function getRateLimitLevel(rateLimitInfo: Record<string, unknown>): RateLimitLevel {
  const usage = rateLimitInfo.appUsage as
    | { call_count?: number; total_cputime?: number; total_time?: number }
    | undefined;
  if (!usage) return "ok";

  const max = Math.max(usage.call_count ?? 0, usage.total_cputime ?? 0, usage.total_time ?? 0);
  if (max >= 90) return "stop";
  if (max >= 80) return "pause";
  if (max >= 60) return "warn";
  return "ok";
}

async function applyRateLimitStatus(
  workspaceId: string,
  rateLimitInfo: Record<string, unknown>
): Promise<void> {
  const level = getRateLimitLevel(rateLimitInfo);
  if (level === "stop") {
    try {
      await db.workspaceCredential.updateMany({
        where: { workspaceId },
        data: {
          status: "rate_limited",
          validationError: "Meta API quota ≥90% — sync paused until quota resets",
          rateLimitInfo: rateLimitInfo as Prisma.InputJsonValue,
          lastValidatedAt: new Date(),
        },
      });
    } catch {
      // Non-blocking
    }
  }
}

export const InstagramMetricCapability = {
  ownAccount: {
    followers: true,
    followsCount: true,
    mediaCount: true,
    insights: true,
    reach: true,
    impressions: true,
    saves: true,
    shares: true,
    likeCount: true,
    commentsCount: true,
    viewsCount: true,
  },
  competitorAccount: {
    followers: "only_if_public_api" as const,
    followsCount: false,
    mediaCount: "only_if_public_api" as const,
    insights: false,
    reach: false,
    impressions: false,
    saves: false,
    shares: false,
    likeCount: "only_if_public_api" as const,
    commentsCount: "only_if_public_api" as const,
    viewsCount: false,
  },
};

export type MetricAvailability = true | false | "only_if_public_api" | "only_if_api_available";

export type BusinessDiscoveryStatus =
  | "available"
  | "requires_live_mode_or_tester"
  | "setup_required"
  | "missing_permissions"
  | "rate_limited"
  | "competitor_not_discoverable"
  | "invalid_username"
  | "invalid_username_or_query_builder_error"
  | "unknown_error";

/**
 * Classifies a Meta Business Discovery error message into a structured status.
 * "(#100) The parameter username is required" indicates a query construction bug
 * (username must be in the field selector, not as &username= query param).
 */
export function classifyBusinessDiscoveryError(errorMessage: string | null): BusinessDiscoveryStatus {
  if (!errorMessage) return "unknown_error";
  const msg = errorMessage.toLowerCase();

  // Query builder bug — username in wrong place in the API call
  if (msg.includes("parameter username is required")) {
    return "invalid_username_or_query_builder_error";
  }
  // Unsupported request — can indicate dev mode or malformed request
  if (msg.includes("unsupported get request")) {
    return "requires_live_mode_or_tester";
  }
  // Missing permissions / OAuth errors
  if (
    msg.includes("missing permissions") ||
    msg.includes("permissions error") ||
    msg.includes("application does not have permission") ||
    msg.includes("cannot be loaded due to missing permissions") ||
    msg.includes("oauthexception")
  ) {
    return "missing_permissions";
  }
  // Rate limiting
  if (msg.includes("rate limit") || msg.includes("too many calls") || msg.includes("user request limit")) {
    return "rate_limited";
  }
  // Account is private, personal, or invalid
  if (msg.includes("object does not exist") || msg.includes("does not exist") || msg.includes("not found")) {
    return "competitor_not_discoverable";
  }
  return "unknown_error";
}

export interface InstagramAccountProfile {
  id: string;
  username: string;
  name?: string;
  biography?: string;
  website?: string;
  profile_picture_url?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
}

export interface InstagramMediaItem {
  id: string;
  media_type: string;
  media_product_type?: string;
  caption?: string;
  permalink?: string;
  thumbnail_url?: string;
  media_url?: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
}

export interface InstagramMediaInsights {
  reach?: number;
  impressions?: number;
  saved?: number;
  shares?: number;
  plays?: number;
  video_views?: number;
}

export interface ApiCallResult<T> {
  data: T | null;
  error: string | null;
  statusCode: number;
  rateLimitInfo?: Record<string, unknown>;
}

export interface MetaRateLimitInfo {
  appUsage?: { call_count: number; total_cputime: number; total_time: number };
  businessUsage?: Record<string, unknown>;
}

export interface TokenValidationResult {
  valid: boolean;
  /** Facebook user ID from /me */
  metaUserId: string | null;
  /** Instagram Business/Creator Account ID discovered from /me/accounts */
  instagramUserId: string | null;
  instagramUsername: string | null;
  igBusinessAccountId: string | null;
  scopes: string[];
  expiresAt: Date | null;
  error: string | null;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function parseRateLimitHeaders(headers: Headers): Record<string, unknown> {
  const info: Record<string, unknown> = {};

  const appUsageRaw = headers.get("x-app-usage");
  if (appUsageRaw) {
    try {
      info.appUsage = JSON.parse(appUsageRaw);
    } catch {
      info.appUsageRaw = appUsageRaw;
    }
  }

  const bizUsageRaw = headers.get("x-business-use-case-usage");
  if (bizUsageRaw) {
    try {
      info.businessUsage = JSON.parse(bizUsageRaw);
    } catch {
      info.businessUsageRaw = bizUsageRaw;
    }
  }

  return info;
}

async function logApiCall(
  workspaceId: string,
  endpoint: string,
  method: string,
  statusCode: number,
  success: boolean,
  errorMessage?: string,
  durationMs?: number,
  rateLimitInfo?: Record<string, unknown>
) {
  try {
    await db.apiLog.create({
      data: {
        workspaceId,
        endpoint,
        method,
        statusCode,
        success,
        errorMessage,
        durationMs,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(rateLimitInfo && Object.keys(rateLimitInfo).length > 0 ? { rateLimitInfo: rateLimitInfo as any } : {}),
      },
    });
  } catch {
    // Non-blocking
  }
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

export async function safeApiCall<T>(
  workspaceId: string,
  url: string,
  options?: RequestInit
): Promise<ApiCallResult<T>> {
  const start = Date.now();
  const method = (options?.method || "GET").toUpperCase();

  try {
    const response = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...options?.headers },
    });

    const durationMs = Date.now() - start;
    const rateLimitInfo = parseRateLimitHeaders(response.headers);

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const errorMessage =
        (errorBody as { error?: { message?: string } })?.error?.message || `HTTP ${response.status}`;

      await logApiCall(workspaceId, url, method, response.status, false, errorMessage, durationMs, rateLimitInfo);

      return { data: null, error: errorMessage, statusCode: response.status, rateLimitInfo };
    }

    const data = (await response.json()) as T;
    await logApiCall(workspaceId, url, method, response.status, true, undefined, durationMs, rateLimitInfo);
    await applyRateLimitStatus(workspaceId, rateLimitInfo);

    return { data, error: null, statusCode: response.status, rateLimitInfo };
  } catch (err) {
    const durationMs = Date.now() - start;
    const errorMessage = err instanceof Error ? err.message : "Network error";
    await logApiCall(workspaceId, url, method, 0, false, errorMessage, durationMs);
    return { data: null, error: errorMessage, statusCode: 0 };
  }
}

export async function isWorkspaceRateLimited(workspaceId: string): Promise<boolean> {
  try {
    const cred = await db.workspaceCredential.findUnique({ where: { workspaceId } });
    return cred?.status === "rate_limited";
  } catch {
    return false;
  }
}

// ─── Token exchange ───────────────────────────────────────────────────────────

export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
  appId = process.env.META_APP_ID || "",
  appSecret = process.env.META_APP_SECRET || ""
): Promise<{ accessToken: string; tokenType: string } | null> {
  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  });

  const response = await fetch(`${BASE_URL}/oauth/access_token?${params}`);
  if (!response.ok) return null;

  const data = (await response.json()) as { access_token: string; token_type?: string };
  return { accessToken: data.access_token, tokenType: data.token_type || "bearer" };
}

export async function getLongLivedToken(
  shortLivedToken: string,
  appId = process.env.META_APP_ID || "",
  appSecret = process.env.META_APP_SECRET || ""
): Promise<{ accessToken: string; expiresIn: number } | null> {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortLivedToken,
  });

  const response = await fetch(`${BASE_URL}/oauth/access_token?${params}`);
  if (!response.ok) return null;

  const data = (await response.json()) as { access_token: string; expires_in?: number };
  return { accessToken: data.access_token, expiresIn: data.expires_in || 5184000 };
}

// ─── Token validation ─────────────────────────────────────────────────────────

/**
 * Validates a Meta (Facebook) access token.
 * Returns metaUserId (Facebook user ID) separately from instagramUserId
 * (IG Business/Creator Account ID discovered via /me/accounts).
 */
export async function validateAccessToken(
  token: string,
  appId?: string,
  appSecret?: string
): Promise<TokenValidationResult> {
  const failed = (error: string): TokenValidationResult => ({
    valid: false,
    metaUserId: null,
    instagramUserId: null,
    instagramUsername: null,
    igBusinessAccountId: null,
    scopes: [],
    expiresAt: null,
    error,
  });

  // Step 1: confirm token is alive and get Facebook user ID
  const meUrl = `${BASE_URL}/me?fields=id,name&access_token=${encodeURIComponent(token)}`;
  const meRes = await fetch(meUrl);
  if (!meRes.ok) {
    const body = await meRes.json().catch(() => ({}));
    const msg = (body as { error?: { message?: string } })?.error?.message || "Token is invalid";
    return failed(msg);
  }
  const meData = (await meRes.json()) as { id: string; name?: string };
  const metaUserId = meData.id;
  console.log(`[validateAccessToken] Facebook user id: ${metaUserId}`);

  // Step 2: get granted permissions
  const permUrl = `${BASE_URL}/me/permissions?access_token=${encodeURIComponent(token)}`;
  const permRes = await fetch(permUrl);
  const scopes: string[] = [];
  if (permRes.ok) {
    const permData = (await permRes.json()) as {
      data: Array<{ permission: string; status: string }>;
    };
    for (const p of permData.data || []) {
      if (p.status === "granted") scopes.push(p.permission);
    }
  }

  // Step 3: get expiry via debug_token (optional)
  let expiresAt: Date | null = null;
  const resolvedAppId = appId || process.env.META_APP_ID || "";
  const resolvedAppSecret = appSecret || process.env.META_APP_SECRET || "";

  if (resolvedAppId && resolvedAppSecret &&
      resolvedAppId !== "your-meta-app-id" && resolvedAppSecret !== "your-meta-app-secret") {
    const appToken = `${resolvedAppId}|${resolvedAppSecret}`;
    const debugUrl = `${BASE_URL}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(appToken)}`;
    const debugRes = await fetch(debugUrl);
    if (debugRes.ok) {
      const debugData = (await debugRes.json()) as {
        data?: { expires_at?: number; is_valid?: boolean };
      };
      const expiresTs = debugData.data?.expires_at;
      if (expiresTs && expiresTs > 0) {
        expiresAt = new Date(expiresTs * 1000);
      }
    }
  }

  // Step 4: discover linked Instagram Business/Creator account
  // Try /me/accounts first, then /me/businesses (for New Pages Experience pages)
  let igBusinessAccountId: string | null = null;
  let instagramUsername: string | null = null;

  const igPageFields = "id,name,instagram_business_account{id,username},connected_instagram_account{id,username}";

  // 4a: /me/accounts (Classic pages)
  const igUrl = `${BASE_URL}/me/accounts?fields=${igPageFields}&access_token=${encodeURIComponent(token)}`;
  const igRes = await fetch(igUrl);
  if (igRes.ok) {
    const igData = (await igRes.json()) as {
      data?: Array<{
        id: string; name: string;
        instagram_business_account?: { id: string; username: string };
        connected_instagram_account?: { id: string; username: string };
      }>;
    };
    const pages = igData.data ?? [];
    console.log(`[validateAccessToken] /me/accounts returned ${pages.length} pages`);
    for (const page of pages) {
      const ig = page.instagram_business_account ?? page.connected_instagram_account;
      if (ig) { igBusinessAccountId = ig.id; instagramUsername = ig.username; break; }
    }
  }

  // 4b: /me/businesses → pages (New Pages Experience pages)
  if (!igBusinessAccountId) {
    const bizUrl = `${BASE_URL}/me/businesses?fields=id,name&access_token=${encodeURIComponent(token)}`;
    const bizRes = await fetch(bizUrl);
    if (bizRes.ok) {
      const bizData = (await bizRes.json()) as { data?: Array<{ id: string; name: string }> };
      const businesses = bizData.data ?? [];
      console.log(`[validateAccessToken] /me/businesses returned ${businesses.length} businesses`);
      for (const biz of businesses) {
        const pagesUrl = `${BASE_URL}/${biz.id}/pages?fields=${igPageFields}&access_token=${encodeURIComponent(token)}`;
        const pagesRes = await fetch(pagesUrl);
        if (pagesRes.ok) {
          const pagesData = (await pagesRes.json()) as {
            data?: Array<{
              id: string; name: string;
              instagram_business_account?: { id: string; username: string };
              connected_instagram_account?: { id: string; username: string };
            }>;
          };
          for (const page of pagesData.data ?? []) {
            const ig = page.instagram_business_account ?? page.connected_instagram_account;
            if (ig) {
              igBusinessAccountId = ig.id; instagramUsername = ig.username;
              console.log(`[validateAccessToken] Found IG account via Business Manager: ${ig.id} (@${ig.username})`);
              break;
            }
          }
        }
        if (igBusinessAccountId) break;
      }
    }
  }

  if (!igBusinessAccountId) {
    console.log("[validateAccessToken] No IG account found via /me/accounts or /me/businesses.");
  } else {
    console.log(`[validateAccessToken] Using IG account: ${igBusinessAccountId} (@${instagramUsername})`);
  }

  return {
    valid: true,
    metaUserId,
    // instagramUserId stores the IG Business Account ID, not the Facebook user ID
    instagramUserId: igBusinessAccountId,
    instagramUsername,
    igBusinessAccountId,
    scopes,
    expiresAt,
    error: null,
  };
}

// ─── Account + media API calls ───────────────────────────────────────────────

/**
 * Discovers Instagram Business/Creator accounts linked to the token's Facebook Pages.
 * Supports both instagram_business_account and connected_instagram_account.
 * Fetches full profiles via getAccountProfile for each discovered account ID.
 */
export async function getConnectedInstagramAccounts(
  workspaceId: string,
  accessToken: string
): Promise<InstagramAccountProfile[]> {
  interface FacebookPageResponse {
    id: string;
    name: string;
    instagram_business_account?: { id: string; username: string };
    connected_instagram_account?: { id: string; username: string };
  }

  const pageFields = "id,name,instagram_business_account{id,username},connected_instagram_account{id,username}";
  const accounts: InstagramAccountProfile[] = [];
  const seenIds = new Set<string>();

  const processPages = async (pages: FacebookPageResponse[]) => {
    for (const page of pages) {
      const ig = page.instagram_business_account ?? page.connected_instagram_account;
      if (!ig || seenIds.has(ig.id)) continue;
      seenIds.add(ig.id);
      console.log(`[getConnectedInstagramAccounts] Found IG account: ${ig.id} (@${ig.username}) on page "${page.name}"`);
      const profile = await getAccountProfile(workspaceId, ig.id, accessToken);
      accounts.push(profile ?? { id: ig.id, username: ig.username });
    }
  };

  // Strategy 1: /me/accounts (Classic pages)
  const classicUrl = `${BASE_URL}/me/accounts?fields=${pageFields}&access_token=${accessToken}`;
  const classicResult = await safeApiCall<{ data: FacebookPageResponse[] }>(workspaceId, classicUrl);
  const classicPages = classicResult.data?.data ?? [];
  console.log(`[getConnectedInstagramAccounts] /me/accounts returned ${classicPages.length} pages`);
  await processPages(classicPages);

  // Strategy 2: /me/businesses → pages (New Pages Experience)
  if (accounts.length === 0) {
    const bizResult = await safeApiCall<{ data: Array<{ id: string; name: string }> }>(
      workspaceId,
      `${BASE_URL}/me/businesses?fields=id,name&access_token=${accessToken}`
    );
    const businesses = bizResult.data?.data ?? [];
    console.log(`[getConnectedInstagramAccounts] /me/businesses returned ${businesses.length} businesses`);
    for (const biz of businesses) {
      const pagesResult = await safeApiCall<{ data: FacebookPageResponse[] }>(
        workspaceId,
        `${BASE_URL}/${biz.id}/pages?fields=${pageFields}&access_token=${accessToken}`
      );
      await processPages(pagesResult.data?.data ?? []);
      if (accounts.length > 0) break;
    }
  }

  if (accounts.length === 0) {
    console.log("[getConnectedInstagramAccounts] No Instagram Business or Creator account found. Make sure the Instagram account is Professional, linked to a Facebook Page, and the Facebook user has Page access.");
  }

  return accounts;
}

export async function getAccountProfile(
  workspaceId: string,
  igUserId: string,
  accessToken: string
): Promise<InstagramAccountProfile | null> {
  const fields =
    "id,username,name,biography,website,profile_picture_url,followers_count,follows_count,media_count";
  const url = `${BASE_URL}/${igUserId}?fields=${fields}&access_token=${accessToken}`;
  const result = await safeApiCall<InstagramAccountProfile>(workspaceId, url);
  return result.data;
}

export async function getRecentMedia(
  workspaceId: string,
  igUserId: string,
  accessToken: string,
  limit = 50
): Promise<InstagramMediaItem[]> {
  const fields =
    "id,media_type,media_product_type,caption,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count";
  const url = `${BASE_URL}/${igUserId}/media?fields=${fields}&limit=${Math.min(limit, 100)}&access_token=${accessToken}`;
  const result = await safeApiCall<{ data: InstagramMediaItem[] }>(workspaceId, url);
  if (!result.data) return [];
  return result.data.data || [];
}

/**
 * Fetches insights for a single media item.
 * Uses media_product_type (preferred) and media_type to select metrics.
 * Falls back to reach-only if the full metric set is rejected, then {} on total failure.
 */
export async function getMediaInsights(
  workspaceId: string,
  mediaId: string,
  mediaType: string,
  mediaProductType: string | null | undefined,
  accessToken: string
): Promise<InstagramMediaInsights> {
  const isReels =
    mediaProductType === "REELS" ||
    mediaType === "REELS";
  const isVideo =
    mediaProductType === "FEED" && mediaType === "VIDEO" ||
    mediaType === "VIDEO";

  // Reels and videos get plays-based metrics; photos get impression-based metrics
  const primaryMetrics =
    isReels || isVideo
      ? "reach,plays,saved,shares"
      : "reach,impressions,saved";

  const parseInsights = (data: Array<{ name: string; values?: Array<{ value: number }>; value?: number }>): InstagramMediaInsights => {
    const insights: InstagramMediaInsights = {};
    for (const metric of data) {
      // Insights v2 returns a flat `value`; v1 returns `values[0].value`
      const value = metric.value ?? metric.values?.[0]?.value;
      if (value != null) {
        (insights as Record<string, number>)[metric.name] = value;
      }
    }
    return insights;
  };

  const primaryUrl = `${BASE_URL}/${mediaId}/insights?metric=${primaryMetrics}&access_token=${accessToken}`;
  const primaryResult = await safeApiCall<{
    data: Array<{ name: string; values?: Array<{ value: number }>; value?: number }>;
  }>(workspaceId, primaryUrl);

  if (primaryResult.data) {
    return parseInsights(primaryResult.data.data ?? []);
  }

  // Fallback: try reach only
  const fallbackUrl = `${BASE_URL}/${mediaId}/insights?metric=reach&access_token=${accessToken}`;
  const fallbackResult = await safeApiCall<{
    data: Array<{ name: string; values?: Array<{ value: number }>; value?: number }>;
  }>(workspaceId, fallbackUrl);

  if (fallbackResult.data) {
    return parseInsights(fallbackResult.data.data ?? []);
  }

  // Both failed — return empty rather than crashing the sync
  return {};
}

// ─── Business Discovery API (competitor public profiles) ─────────────────────

export interface CompetitorPublicProfile {
  id: string;
  username: string;
  name?: string;
  biography?: string;
  website?: string;
  profile_picture_url?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
  media?: { data: InstagramMediaItem[] };
}

export interface CompetitorPublicProfileResult {
  profile: CompetitorPublicProfile | null;
  errorStatus: BusinessDiscoveryStatus | null;
  errorMessage: string | null;
}

/**
 * Fetches public profile + recent media for a competitor IG Business account
 * via the Business Discovery API. Requires your own IG Business Account ID as lens.
 *
 * Returns a structured result so callers can distinguish Development mode gating
 * (requires_live_mode_or_tester) from genuine errors or missing permissions.
 */
export async function getCompetitorPublicProfile(
  workspaceId: string,
  ownIgUserId: string,
  competitorUsername: string,
  accessToken: string,
  mediaLimit = 30
): Promise<CompetitorPublicProfileResult> {
  const normalizedUsername = _normalizeInstagramUsername(competitorUsername);

  if (!normalizedUsername) {
    return {
      profile: null,
      errorStatus: "invalid_username",
      errorMessage: "Enter the Instagram username without @.",
    };
  }

  const limit = Math.min(mediaLimit, 50);
  const mediaFields = `media.limit(${limit}){id,media_type,media_product_type,caption,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count}`;
  const profileFields = `id,username,name,biography,website,profile_picture_url,followers_count,follows_count,media_count,${mediaFields}`;
  // Correct Business Discovery syntax: username embedded in field selector, NOT as a query param
  const fields = `business_discovery.username(${normalizedUsername}){${profileFields}}`;
  // Encode only { and } — commas/parens must stay raw for Meta's Graph API parser
  const encodedFields = fields.replace(/\{/g, "%7B").replace(/\}/g, "%7D");
  const url = `${BASE_URL}/${ownIgUserId}?fields=${encodedFields}&access_token=${accessToken}`;

  console.log("[BusinessDiscovery] username=%s ownId=%s", normalizedUsername, ownIgUserId);

  const result = await safeApiCall<{ business_discovery: CompetitorPublicProfile }>(workspaceId, url);

  if (result.error || !result.data?.business_discovery) {
    const errorStatus = classifyBusinessDiscoveryError(result.error);
    return { profile: null, errorStatus, errorMessage: result.error };
  }

  return { profile: result.data.business_discovery, errorStatus: null, errorMessage: null };
}

/**
 * Resolves the caller's own Instagram Business Account ID for use with Business Discovery.
 * Lookup order:
 *   A. workspaceCredential.igBusinessAccountId (manually set or previously cached)
 *   B. active InstagramConnection.instagramUserId
 *   C. /me/accounts (live API call — caches result in DB)
 *   D. fails with null and logs a clear error
 */
export async function getOwnInstagramBusinessAccountId(
  workspaceId: string,
  accessToken: string
): Promise<string | null> {
  // Strategy A: DB-stored value (manually set or previously discovered)
  const cred = await db.workspaceCredential.findUnique({ where: { workspaceId } });
  if (cred?.igBusinessAccountId) {
    console.log(`[IGAccountId] Strategy A: using stored igBusinessAccountId ${cred.igBusinessAccountId}`);
    return cred.igBusinessAccountId;
  }

  // Strategy B: any active InstagramConnection for this workspace
  const activeConn = await db.instagramConnection.findFirst({
    where: { workspaceId, status: "active" },
    orderBy: { updatedAt: "desc" },
  });
  if (activeConn?.instagramUserId) {
    console.log(`[IGAccountId] Strategy B: using active InstagramConnection ${activeConn.instagramUserId}`);
    await db.workspaceCredential.updateMany({
      where: { workspaceId },
      data: { igBusinessAccountId: activeConn.instagramUserId },
    });
    return activeConn.instagramUserId;
  }

  const igPageFields = "id,name,instagram_business_account{id},connected_instagram_account{id}";

  const findIgIdInPages = (pages: Array<{ id: string; name: string; instagram_business_account?: { id: string }; connected_instagram_account?: { id: string } }>): string | null => {
    for (const page of pages) {
      const id = page.instagram_business_account?.id ?? page.connected_instagram_account?.id;
      if (id) return id;
    }
    return null;
  };

  // Strategy C: /me/accounts (Classic pages)
  const pagesResult = await safeApiCall<{ data: Array<{ id: string; name: string; instagram_business_account?: { id: string }; connected_instagram_account?: { id: string } }> }>(
    workspaceId,
    `${BASE_URL}/me/accounts?fields=${igPageFields}&access_token=${accessToken}`
  );
  if (pagesResult.data) {
    const pages = pagesResult.data.data ?? [];
    console.log(`[IGAccountId] Strategy C: /me/accounts returned ${pages.length} pages`);
    const id = findIgIdInPages(pages);
    if (id) {
      console.log(`[IGAccountId] Strategy C: found IG account ${id}`);
      await db.workspaceCredential.updateMany({ where: { workspaceId }, data: { igBusinessAccountId: id } });
      return id;
    }
  }

  // Strategy D: /me/businesses → pages (New Pages Experience)
  const bizResult = await safeApiCall<{ data: Array<{ id: string; name: string }> }>(
    workspaceId,
    `${BASE_URL}/me/businesses?fields=id,name&access_token=${accessToken}`
  );
  const businesses = bizResult.data?.data ?? [];
  console.log(`[IGAccountId] Strategy D: /me/businesses returned ${businesses.length} businesses`);
  for (const biz of businesses) {
    const bizPagesResult = await safeApiCall<{ data: Array<{ id: string; name: string; instagram_business_account?: { id: string }; connected_instagram_account?: { id: string } }> }>(
      workspaceId,
      `${BASE_URL}/${biz.id}/pages?fields=${igPageFields}&access_token=${accessToken}`
    );
    const bizPages = bizPagesResult.data?.data ?? [];
    const id = findIgIdInPages(bizPages);
    if (id) {
      console.log(`[IGAccountId] Strategy D: found IG account ${id} via Business Manager "${biz.name}"`);
      await db.workspaceCredential.updateMany({ where: { workspaceId }, data: { igBusinessAccountId: id } });
      return id;
    }
  }

  console.log("[IGAccountId] All strategies exhausted. No Instagram Business or Creator account found.");
  return null;
}

export async function getAccountInsights(
  workspaceId: string,
  igUserId: string,
  accessToken: string,
  period: "day" | "week" | "month" = "day"
): Promise<Record<string, number>> {
  const metrics = "reach,impressions,follower_count,profile_views";
  const url = `${BASE_URL}/${igUserId}/insights?metric=${metrics}&period=${period}&access_token=${accessToken}`;
  const result = await safeApiCall<{
    data: Array<{ name: string; values: Array<{ value: number }> }>;
  }>(workspaceId, url);

  if (!result.data) return {};

  const insights: Record<string, number> = {};
  for (const metric of result.data.data || []) {
    const value = metric.values?.[0]?.value;
    if (value != null) {
      insights[metric.name] = value;
    }
  }
  return insights;
}
