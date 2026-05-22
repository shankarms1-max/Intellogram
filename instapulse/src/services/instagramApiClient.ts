import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

const GRAPH_API_VERSION = process.env.INSTAGRAM_GRAPH_API_VERSION || "v21.0";
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// ─── Rate-limit thresholds ────────────────────────────────────────────────────
// Meta X-App-Usage reports call_count / total_cputime / total_time as % of quota.
// We pick the highest of the three to determine severity.

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

/** Updates WorkspaceCredential.status to rate_limited when the workspace hits 90%+ quota. */
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

/** Parsed Meta rate limit headers captured per call. */
export interface MetaRateLimitInfo {
  appUsage?: { call_count: number; total_cputime: number; total_time: number };
  businessUsage?: Record<string, unknown>;
}

export interface TokenValidationResult {
  valid: boolean;
  instagramUserId: string | null;
  instagramUsername: string | null;
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
    // Non-blocking — log failures must never crash a sync
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

/** Returns true if this workspace's rate-limit status is "stop" (≥90%). Callers should skip sync. */
export async function isWorkspaceRateLimited(workspaceId: string): Promise<boolean> {
  try {
    const cred = await db.workspaceCredential.findUnique({ where: { workspaceId } });
    return cred?.status === "rate_limited";
  } catch {
    return false;
  }
}

// ─── Token exchange (accepts dynamic app credentials) ─────────────────────────

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

// ─── Token validation (no workspace logging — used pre-connection) ────────────

/**
 * Validates a Meta access token and returns profile + permission info.
 * Uses /me and /me/permissions which work without debug_token app secret.
 * Falls back to debug_token if appId + appSecret are provided (more info).
 */
export async function validateAccessToken(
  token: string,
  appId?: string,
  appSecret?: string
): Promise<TokenValidationResult> {
  // Step 1: confirm token is alive + get user ID
  const meUrl = `${BASE_URL}/me?fields=id,name&access_token=${encodeURIComponent(token)}`;
  const meRes = await fetch(meUrl);
  if (!meRes.ok) {
    const body = await meRes.json().catch(() => ({}));
    const msg = (body as { error?: { message?: string } })?.error?.message || "Token is invalid";
    return { valid: false, instagramUserId: null, instagramUsername: null, scopes: [], expiresAt: null, error: msg };
  }
  const meData = (await meRes.json()) as { id: string; name?: string };

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

  // Step 3: get expiry via debug_token (optional — needs app credentials)
  let expiresAt: Date | null = null;
  let instagramUsername: string | null = null;

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

  // Step 4: get linked Instagram account (for display)
  const igUrl = `${BASE_URL}/me/accounts?fields=instagram_business_account{id,username}&access_token=${encodeURIComponent(token)}`;
  const igRes = await fetch(igUrl);
  if (igRes.ok) {
    const igData = (await igRes.json()) as {
      data?: Array<{ instagram_business_account?: { id: string; username: string } }>;
    };
    const firstIg = igData.data?.[0]?.instagram_business_account;
    if (firstIg) {
      instagramUsername = firstIg.username;
    }
  }

  return {
    valid: true,
    instagramUserId: meData.id,
    instagramUsername,
    scopes,
    expiresAt,
    error: null,
  };
}

// ─── Account + media API calls ───────────────────────────────────────────────

export async function getConnectedInstagramAccounts(
  workspaceId: string,
  accessToken: string
): Promise<InstagramAccountProfile[]> {
  const url = `${BASE_URL}/me/accounts?fields=instagram_business_account{id,username,name,biography,website,profile_picture_url,followers_count,follows_count,media_count}&access_token=${accessToken}`;

  interface FacebookPageResponse {
    id: string;
    instagram_business_account?: InstagramAccountProfile;
  }
  const result = await safeApiCall<{ data: FacebookPageResponse[] }>(workspaceId, url);
  if (!result.data) return [];

  const accounts: InstagramAccountProfile[] = [];
  for (const page of result.data.data || []) {
    if (page.instagram_business_account) {
      accounts.push(page.instagram_business_account);
    }
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

export async function getMediaInsights(
  workspaceId: string,
  mediaId: string,
  mediaType: string,
  accessToken: string
): Promise<InstagramMediaInsights> {
  const metrics =
    mediaType === "VIDEO" || mediaType === "REELS"
      ? "reach,impressions,saved,shares,plays,video_views"
      : "reach,impressions,saved,shares";

  const url = `${BASE_URL}/${mediaId}/insights?metric=${metrics}&access_token=${accessToken}`;
  const result = await safeApiCall<{
    data: Array<{ name: string; values: Array<{ value: number }> }>;
  }>(workspaceId, url);

  if (!result.data) return {};

  const insights: InstagramMediaInsights = {};
  for (const metric of result.data.data || []) {
    const value = metric.values?.[0]?.value;
    if (value != null) {
      (insights as Record<string, number>)[metric.name] = value;
    }
  }
  return insights;
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
  media_count?: number;
  media?: { data: InstagramMediaItem[] };
}

/**
 * Fetches public profile + recent media for a competitor/public IG Business account
 * using the Business Discovery API. Requires your own connected IG Business Account ID.
 */
export async function getCompetitorPublicProfile(
  workspaceId: string,
  ownIgUserId: string,
  competitorUsername: string,
  accessToken: string,
  mediaLimit = 30
): Promise<CompetitorPublicProfile | null> {
  const mediaFields = `media.limit(${Math.min(mediaLimit, 50)}){id,media_type,caption,permalink,thumbnail_url,timestamp,like_count,comments_count}`;
  const profileFields = `id,username,name,biography,website,profile_picture_url,followers_count,media_count,${mediaFields}`;
  const fields = `business_discovery.fields(${profileFields})`;
  const url = `${BASE_URL}/${ownIgUserId}?fields=${encodeURIComponent(fields)}&username=${encodeURIComponent(competitorUsername)}&access_token=${accessToken}`;

  const result = await safeApiCall<{ business_discovery: CompetitorPublicProfile }>(workspaceId, url);
  if (!result.data?.business_discovery) return null;
  return result.data.business_discovery;
}

/**
 * Gets the caller's own Instagram Business Account ID from their FB page list.
 * Required as the entry point for Business Discovery API calls.
 */
export async function getOwnInstagramBusinessAccountId(
  workspaceId: string,
  accessToken: string
): Promise<string | null> {
  const url = `${BASE_URL}/me/accounts?fields=instagram_business_account{id}&access_token=${accessToken}`;
  const result = await safeApiCall<{
    data: Array<{ instagram_business_account?: { id: string } }>;
  }>(workspaceId, url);
  if (!result.data) return null;
  for (const page of result.data.data || []) {
    if (page.instagram_business_account?.id) {
      return page.instagram_business_account.id;
    }
  }
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
