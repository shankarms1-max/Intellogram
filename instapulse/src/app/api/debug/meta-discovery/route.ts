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
  const bizRaw: { data?: Array<{ id: string; name: string }>; error?: { code?: number; message?: string } } =
    bizRes.ok ? await bizRes.json() : { error: { message: "http_error" } };
  const bizData = bizRaw;
  const businesses = bizData.data ?? [];
  const meBusinessesStatus: "success" | "empty" | "missing_permission" | "failed" = (() => {
    if (bizRaw.error) {
      const msg = bizRaw.error.message?.toLowerCase() ?? "";
      if (msg.includes("missing permission") || msg.includes("permission")) return "missing_permission";
      return "failed";
    }
    return businesses.length > 0 ? "success" : "empty";
  })();

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

  const businessManagementGranted = grantedScopes.includes("business_management");
  const hasPageScopes =
    grantedScopes.includes("pages_show_list") && grantedScopes.includes("pages_read_engagement");

  // Determine Business Discovery readiness
  let businessDiscoveryModeStatus: string;
  if (hasPageScopes && pages.length === 0 && !businessManagementGranted && meBusinessesStatus === "missing_permission") {
    businessDiscoveryModeStatus = "business_manager_permission_required";
  } else if (hasPageScopes && pages.length === 0) {
    businessDiscoveryModeStatus = "page_permissions_granted_but_no_pages_returned";
  } else if (!selectedIgBusinessAccountId) {
    businessDiscoveryModeStatus = "missing_ig_business_account";
  } else if (!grantedScopes.includes("instagram_manage_insights") && !businessManagementGranted) {
    businessDiscoveryModeStatus = "missing_permissions";
  } else {
    businessDiscoveryModeStatus = "requires_live_mode_for_public_competitors";
  }

  // Human-readable likely issue for quick triage
  const likelyIssue = (() => {
    if (businessDiscoveryModeStatus === "page_permissions_granted_but_no_pages_returned") {
      return "Page permissions granted, but no API-visible Pages returned. The Facebook user may not have full-control task access to the Page, or the Page–Instagram link is managed through Business Portfolio.";
    }
    if (businessDiscoveryModeStatus === "business_manager_permission_required") {
      return "Pages appear to be managed through Meta Business Portfolio. Business Manager fallback requires the optional business_management permission.";
    }
    if (businessDiscoveryModeStatus === "missing_ig_business_account") {
      return "No Instagram Business Account ID found. Connect an Instagram Business or Creator account linked to a Facebook Page.";
    }
    if (businessDiscoveryModeStatus === "missing_permissions") {
      return "Token lacks instagram_manage_insights. Reconnect and approve all requested permissions.";
    }
    return "Setup looks correct. Business Discovery for public competitors requires Meta Live mode (after App Review).";
  })();

  return NextResponse.json({
    metaUserId: meData.id ?? null,
    metaUserName: meData.name ?? null,
    grantedScopes,
    businessManagementGranted,
    meAccountsCount: pages.length,
    classicPages: pages,
    meBusinessesStatus,
    businessesCount: businesses.length,
    businessPages,
    storedIgBusinessAccountId,
    selectedIgBusinessAccountId,
    selectedInstagramUsername,
    businessDiscoveryModeStatus,
    likelyIssue,
    note: "Access tokens are never returned by this endpoint.",
  });
}
