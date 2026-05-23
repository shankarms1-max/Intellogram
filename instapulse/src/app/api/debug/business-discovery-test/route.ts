import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { decryptToken } from "@/lib/encryption";
import { normalizeInstagramUsername, getOwnInstagramBusinessAccountId, COMPETITOR_BUSINESS_DISCOVERY_FIELDS } from "@/services/instagramApiClient";

const GRAPH_API_VERSION = process.env.INSTAGRAM_GRAPH_API_VERSION || "v21.0";
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

/**
 * GET /api/debug/business-discovery-test?username=<instagram_username>
 * Tests the Business Discovery API using the active workspace token.
 * Returns full diagnostic output — never returns the access token itself.
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

  // ─── Resolve token — prefer OAuth InstagramConnection, fall back to BYOK ─────

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

  // ─── Build request exactly as getCompetitorPublicProfile() does ───────────────

  const profileFields = COMPETITOR_BUSINESS_DISCOVERY_FIELDS.join(",");
  const fields = `business_discovery.username(${normalizedUsername}){${profileFields}}`;
  const exactEndpoint = `${BASE_URL}/${igBusinessAccountId}`;

  const params = new URLSearchParams();
  params.set("fields", fields);
  params.set("access_token", accessToken);
  const url = `${exactEndpoint}?${params.toString()}`;

  // ─── Execute ──────────────────────────────────────────────────────────────────

  let success = false;
  let businessDiscoveryFound = false;
  let mediaCountReturned: number | null = null;
  let firstMediaPermalink: string | null = null;
  let businessDiscoveryResult: unknown = null;
  let safeMetaError: unknown = null;

  try {
    const res = await fetch(url);
    const body = await res.json() as {
      business_discovery?: {
        id?: string;
        username?: string;
        followers_count?: number;
        media_count?: number;
        media?: { data: Array<{ permalink?: string }> };
      };
      error?: unknown;
    };

    if (res.ok && body.business_discovery) {
      success = true;
      businessDiscoveryFound = true;
      const bd = body.business_discovery;
      mediaCountReturned = bd.media?.data?.length ?? null;
      firstMediaPermalink = bd.media?.data?.[0]?.permalink ?? null;
      // Return profile without media array (it can be large)
      businessDiscoveryResult = {
        id: bd.id,
        username: bd.username,
        followers_count: bd.followers_count,
        media_count: bd.media_count,
        mediaInResponse: mediaCountReturned,
      };
    } else {
      safeMetaError = body.error ?? body;
    }
  } catch (err) {
    safeMetaError = { message: err instanceof Error ? err.message : "Network error" };
  }

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
    exactEndpoint,
    exactFields: fields,
    // Result
    businessDiscoveryFound,
    mediaCountReturned,
    firstMediaPermalink,
    businessDiscoveryResult,
    safeMetaError,
    note: "Access tokens are never returned by this endpoint.",
  });
}
