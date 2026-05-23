import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { decryptToken } from "@/lib/encryption";
import {
  normalizeInstagramUsername,
  getOwnInstagramBusinessAccountId,
  fetchCompetitorMediaNextPage,
  COMPETITOR_BUSINESS_DISCOVERY_FIELDS,
  COMPETITOR_MEDIA_SUBFIELDS,
  SYNC_MODE_LIMITS,
  CompetitorSyncMode,
  InstagramMediaItem,
} from "@/services/instagramApiClient";

const GRAPH_API_VERSION = process.env.INSTAGRAM_GRAPH_API_VERSION || "v21.0";
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

const VALID_SYNC_MODES: CompetitorSyncMode[] = ["daily_refresh", "initial_import", "manual_deep_import"];

/**
 * GET /api/debug/business-discovery-test?username=<username>[&syncMode=daily_refresh|initial_import|manual_deep_import][&limit=25|100|500]
 * Tests the Business Discovery API and returns diagnostic output.
 * Never returns the access token.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; name?: string | null };
  const workspace = await getOrCreateDefaultWorkspace(user.id, user.name);

  const rawUsername = request.nextUrl.searchParams.get("username") ?? "";
  const normalizedUsername = normalizeInstagramUsername(rawUsername);

  if (!normalizedUsername) {
    return NextResponse.json({
      success: false,
      rawUsername,
      normalizedUsername: null,
      error: "Invalid username. Use letters, numbers, dots, or underscores (max 30 chars), with or without @.",
    }, { status: 400 });
  }

  // Parse syncMode — default daily_refresh
  const rawSyncMode = request.nextUrl.searchParams.get("syncMode") ?? "daily_refresh";
  const syncMode: CompetitorSyncMode = VALID_SYNC_MODES.includes(rawSyncMode as CompetitorSyncMode)
    ? (rawSyncMode as CompetitorSyncMode)
    : "daily_refresh";

  const { mediaLimit, maxPages } = SYNC_MODE_LIMITS[syncMode];

  // Parse optional limit override (capped by sync mode)
  const rawLimit = parseInt(request.nextUrl.searchParams.get("limit") ?? "0", 10);
  const requestedLimit = rawLimit > 0 ? Math.min(rawLimit, mediaLimit) : mediaLimit;

  // ─── Resolve token ─────────────────────────────────────────────────────────

  let accessToken: string | null = null;
  let tokenSource: "instagram_connection" | "byok_token" | "none" = "none";
  let grantedScopes: string[] = [];
  let tokenExpiresAt: Date | null = null;
  let instagramUserIdFromConnection: string | null = null;

  const activeConn = await db.instagramConnection.findFirst({
    where: { workspaceId: workspace.id, status: "active" },
    orderBy: { updatedAt: "desc" },
  });
  if (activeConn?.accessTokenEncrypted) {
    try {
      accessToken = decryptToken(activeConn.accessTokenEncrypted);
      tokenSource = "instagram_connection";
      grantedScopes = activeConn.scopes ?? [];
      tokenExpiresAt = activeConn.tokenExpiresAt ?? null;
      instagramUserIdFromConnection = activeConn.instagramUserId;
    } catch { /* fall through */ }
  }

  if (!accessToken) {
    const cred = await db.workspaceCredential.findUnique({ where: { workspaceId: workspace.id } });
    if (cred?.accessTokenEncrypted) {
      try {
        accessToken = decryptToken(cred.accessTokenEncrypted);
        tokenSource = "byok_token";
      } catch { /* ignore */ }
    }
  }

  if (!accessToken) {
    return NextResponse.json({
      success: false,
      tokenSource: "none",
      error: "No access token found. Connect your Instagram account first.",
    }, { status: 400 });
  }

  const igBusinessAccountId = await getOwnInstagramBusinessAccountId(workspace.id, accessToken);
  if (!igBusinessAccountId) {
    return NextResponse.json({
      success: false,
      tokenSource,
      grantedScopes,
      expiresAt: tokenExpiresAt,
      instagramUserIdFromConnection,
      error: "Could not resolve your Instagram Business Account ID.",
    }, { status: 400 });
  }

  // ─── First page — same as getCompetitorPublicProfile ──────────────────────

  const profileFields = COMPETITOR_BUSINESS_DISCOVERY_FIELDS.join(",");
  const fields = `business_discovery.username(${normalizedUsername}){${profileFields}}`;
  const exactEndpoint = `${BASE_URL}/${igBusinessAccountId}`;

  const params = new URLSearchParams();
  params.set("fields", fields);
  params.set("access_token", accessToken);
  const url = `${exactEndpoint}?${params.toString()}`;

  let success = false;
  let businessDiscoveryFound = false;
  let mediaCountReturned: number | null = null;
  let firstMediaPermalink: string | null = null;
  let businessDiscoveryResult: unknown = null;
  let safeMetaError: unknown = null;
  let pagesFetched = 0;
  let viewCountReturned = false;
  const allMedia: InstagramMediaItem[] = [];
  let nextCursor: string | null = null;

  try {
    const res = await fetch(url);
    const body = await res.json() as {
      business_discovery?: {
        id?: string;
        username?: string;
        followers_count?: number;
        media_count?: number;
        media?: {
          data: InstagramMediaItem[];
          paging?: { cursors?: { after?: string } };
        };
      };
      error?: unknown;
    };

    if (res.ok && body.business_discovery) {
      success = true;
      businessDiscoveryFound = true;
      pagesFetched = 1;
      const bd = body.business_discovery;
      const firstPage = bd.media?.data ?? [];
      allMedia.push(...firstPage);
      nextCursor = bd.media?.paging?.cursors?.after ?? null;
      firstMediaPermalink = firstPage[0]?.permalink ?? null;
      businessDiscoveryResult = {
        id: bd.id,
        username: bd.username,
        followers_count: bd.followers_count,
        media_count: bd.media_count,
        mediaInResponse: firstPage.length,
      };
    } else {
      safeMetaError = body.error ?? body;
    }
  } catch (err) {
    safeMetaError = { message: err instanceof Error ? err.message : "Network error" };
  }

  // ─── Additional pages if syncMode requires it ─────────────────────────────

  if (success && nextCursor && allMedia.length < requestedLimit && maxPages > 1) {
    while (nextCursor && allMedia.length < requestedLimit && pagesFetched < maxPages) {
      try {
        const pageResult = await fetchCompetitorMediaNextPage(
          workspace.id, igBusinessAccountId, normalizedUsername, nextCursor, accessToken, 25
        );
        if (pageResult.error || pageResult.items.length === 0) break;
        allMedia.push(...pageResult.items);
        pagesFetched++;
        nextCursor = pageResult.nextCursor;
        if (!nextCursor) break;
      } catch { break; }
    }
  }

  // ─── Build mediaSample ────────────────────────────────────────────────────

  mediaCountReturned = allMedia.length;
  viewCountReturned = allMedia.some((m) => m.view_count != null);

  const mediaSample = allMedia.slice(0, 10).map((m) => ({
    id: m.id,
    media_type: m.media_type,
    media_product_type: m.media_product_type ?? null,
    hasViewCount: m.view_count != null,
    view_count: m.view_count ?? null,
    like_count: m.like_count ?? null,
    comments_count: m.comments_count ?? null,
  }));

  return NextResponse.json({
    success,
    // Token info
    tokenExists: true,
    tokenSource,
    grantedScopes,
    expiresAt: tokenExpiresAt,
    instagramUserIdFromConnection,
    igBusinessAccountIdUsed: igBusinessAccountId,
    // Request
    rawUsername,
    normalizedUsername,
    syncMode,
    requestedLimit,
    exactEndpoint,
    exactFields: fields,
    competitorMediaSubfields: COMPETITOR_MEDIA_SUBFIELDS,
    // Result
    businessDiscoveryFound,
    mediaCountReturned,
    pagesFetched,
    firstMediaPermalink,
    viewCountReturned,
    mediaSample,
    businessDiscoveryResult,
    safeMetaError,
    note: "Access tokens are never returned by this endpoint.",
  });
}
