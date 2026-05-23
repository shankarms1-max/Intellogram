import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { decryptToken } from "@/lib/encryption";
import { normalizeInstagramUsername, getOwnInstagramBusinessAccountId } from "@/services/instagramApiClient";

const GRAPH_API_VERSION = process.env.INSTAGRAM_GRAPH_API_VERSION || "v21.0";
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

/**
 * GET /api/debug/business-discovery-test?username=<instagram_username>
 * Tests the Business Discovery API call for a given username using the active workspace token.
 * Never returns access tokens.
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

  // Resolve access token
  let accessToken: string | null = null;

  const activeConn = await db.instagramConnection.findFirst({
    where: { workspaceId: workspace.id, status: "active" },
    orderBy: { updatedAt: "desc" },
  });
  if (activeConn?.accessTokenEncrypted) {
    try { accessToken = decryptToken(activeConn.accessTokenEncrypted); } catch { /* ignore */ }
  }

  if (!accessToken) {
    const cred = await db.workspaceCredential.findUnique({ where: { workspaceId: workspace.id } });
    if (cred?.accessTokenEncrypted) {
      try { accessToken = decryptToken(cred.accessTokenEncrypted); } catch { /* ignore */ }
    }
  }

  if (!accessToken) {
    return NextResponse.json({ error: "No access token found. Connect your Instagram account first." }, { status: 400 });
  }

  const igBusinessAccountId = await getOwnInstagramBusinessAccountId(workspace.id, accessToken);
  if (!igBusinessAccountId) {
    return NextResponse.json({ error: "Could not resolve your Instagram Business Account ID." }, { status: 400 });
  }

  const fields = `business_discovery.username(${normalizedUsername}){id,username,name,biography,followers_count,media_count}`;
  const encodedFields = fields.replace(/\{/g, "%7B").replace(/\}/g, "%7D");
  const url = `${BASE_URL}/${igBusinessAccountId}?fields=${encodedFields}&access_token=${accessToken}`;

  let businessDiscoveryResult: unknown = null;
  let safeMetaError: unknown = null;
  let success = false;

  try {
    const res = await fetch(url);
    const body = await res.json();
    if (res.ok && body.business_discovery) {
      success = true;
      businessDiscoveryResult = body.business_discovery;
    } else {
      safeMetaError = (body as { error?: unknown }).error ?? body;
    }
  } catch (err) {
    safeMetaError = { message: err instanceof Error ? err.message : "Network error" };
  }

  return NextResponse.json({
    success,
    igBusinessAccountIdUsed: igBusinessAccountId,
    rawUsername,
    normalizedUsername,
    businessDiscoveryResult,
    safeMetaError,
    note: "Access tokens are never returned by this endpoint.",
  });
}
