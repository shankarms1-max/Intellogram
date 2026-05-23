import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { decryptToken } from "@/lib/encryption";

const GRAPH_API_VERSION = process.env.INSTAGRAM_GRAPH_API_VERSION || "v21.0";
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

/**
 * GET /api/debug/meta-discovery
 * Development-only route that shows how the token resolves to a Meta user,
 * which Facebook Pages are accessible, and which IG account would be selected.
 * Never returns access tokens.
 */
export async function GET() {
  if (process.env.ENABLE_DEBUG_ROUTES !== "true") {
    return NextResponse.json({ error: "Not available. Set ENABLE_DEBUG_ROUTES=true to enable." }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; name?: string | null };
  const workspace = await getOrCreateDefaultWorkspace(user.id, user.name);

  // Resolve token — prefer active InstagramConnection, fall back to BYOK credential
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

  // /me — Facebook user ID
  const meRes = await fetch(`${BASE_URL}/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`);
  const meData: { id?: string; name?: string; error?: unknown } = meRes.ok ? await meRes.json() : {};

  // /me/permissions — granted scopes
  const permRes = await fetch(`${BASE_URL}/me/permissions?access_token=${encodeURIComponent(accessToken)}`);
  const permData: { data?: Array<{ permission: string; status: string }> } = permRes.ok ? await permRes.json() : {};
  const grantedScopes = (permData.data ?? [])
    .filter((p) => p.status === "granted")
    .map((p) => p.permission);

  const pageFields = "id,name,instagram_business_account{id,username},connected_instagram_account{id,username}";

  type RawPage = {
    id: string; name: string;
    instagram_business_account?: { id: string; username: string };
    connected_instagram_account?: { id: string; username: string };
  };

  const mapPages = (raw: RawPage[]) => raw.map((page) => ({
    pageId: page.id,
    pageName: page.name,
    hasInstagramBusinessAccount: !!page.instagram_business_account,
    instagramBusinessAccountId: page.instagram_business_account?.id ?? null,
    instagramBusinessAccountUsername: page.instagram_business_account?.username ?? null,
    hasConnectedInstagramAccount: !!page.connected_instagram_account,
    connectedInstagramAccountId: page.connected_instagram_account?.id ?? null,
    connectedInstagramAccountUsername: page.connected_instagram_account?.username ?? null,
  }));

  // /me/accounts — Classic pages
  const accountsRes = await fetch(`${BASE_URL}/me/accounts?fields=${pageFields}&access_token=${encodeURIComponent(accessToken)}`);
  const accountsData: { data?: RawPage[]; error?: unknown } = accountsRes.ok ? await accountsRes.json() : { error: "call failed" };
  const pages = mapPages(accountsData.data ?? []);

  // /me/businesses → pages — New Pages Experience
  const bizRes = await fetch(`${BASE_URL}/me/businesses?fields=id,name&access_token=${encodeURIComponent(accessToken)}`);
  const bizData: { data?: Array<{ id: string; name: string }> } = bizRes.ok ? await bizRes.json() : {};
  const businesses = bizData.data ?? [];

  const businessPages: Array<{ businessId: string; businessName: string; pages: ReturnType<typeof mapPages> }> = [];
  for (const biz of businesses) {
    const bpRes = await fetch(`${BASE_URL}/${biz.id}/pages?fields=${pageFields}&access_token=${encodeURIComponent(accessToken)}`);
    const bpData: { data?: RawPage[] } = bpRes.ok ? await bpRes.json() : {};
    businessPages.push({ businessId: biz.id, businessName: biz.name, pages: mapPages(bpData.data ?? []) });
  }

  // Determine which IG account would be selected
  const cred = await db.workspaceCredential.findUnique({ where: { workspaceId: workspace.id } });
  const storedIgBusinessAccountId = cred?.igBusinessAccountId ?? null;

  let selectedIgBusinessAccountId: string | null = storedIgBusinessAccountId;
  let selectedInstagramUsername: string | null = null;

  const allPages = [
    ...pages,
    ...businessPages.flatMap((b) => b.pages),
  ];
  for (const page of allPages) {
    const id = page.instagramBusinessAccountId ?? page.connectedInstagramAccountId;
    const username = page.instagramBusinessAccountUsername ?? page.connectedInstagramAccountUsername;
    if (id) {
      if (!selectedIgBusinessAccountId) selectedIgBusinessAccountId = id;
      if (id === selectedIgBusinessAccountId) selectedInstagramUsername = username;
    }
  }

  // Determine Business Discovery readiness (cannot detect app mode from API; infer from setup)
  let businessDiscoveryModeStatus: string;
  if (!selectedIgBusinessAccountId) {
    businessDiscoveryModeStatus = "missing_ig_business_account";
  } else if (!grantedScopes.includes("instagram_manage_insights") && !grantedScopes.includes("business_management")) {
    businessDiscoveryModeStatus = "missing_permissions";
  } else {
    // Setup looks correct. In Development mode, public competitor Business Discovery fails
    // with a spurious "(#100) The parameter username is required." error even when
    // the username IS provided. Switch app to Live mode after App Review to resolve.
    businessDiscoveryModeStatus = "requires_live_mode_for_public_competitors";
  }

  return NextResponse.json({
    metaUserId: meData.id ?? null,
    metaUserName: meData.name ?? null,
    grantedScopes,
    classicPagesCount: pages.length,
    classicPages: pages,
    businessesCount: businesses.length,
    businessPages,
    storedIgBusinessAccountId,
    selectedIgBusinessAccountId,
    selectedInstagramUsername,
    businessDiscoveryModeStatus,
    note: "Access tokens are never returned by this endpoint.",
  });
}
