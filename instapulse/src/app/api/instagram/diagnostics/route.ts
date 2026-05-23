import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { decryptToken } from "@/lib/encryption";

const GRAPH_API_VERSION = process.env.INSTAGRAM_GRAPH_API_VERSION || "v21.0";
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export type PagesDiagnosticIssue =
  | "no_token"
  | "page_permissions_granted_but_no_pages_returned"
  | "business_manager_permission_required"
  | "no_issue_detected"
  | "api_error";

export interface PagesDiagnostic {
  grantedScopes: string[];
  pagesCount: number;
  businessManagementGranted: boolean;
  businessesAccessible: boolean | null;
  likelyIssue: PagesDiagnosticIssue;
}

export async function GET() {
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
    const result: PagesDiagnostic = {
      grantedScopes: [],
      pagesCount: 0,
      businessManagementGranted: false,
      businessesAccessible: null,
      likelyIssue: "no_token",
    };
    return NextResponse.json(result);
  }

  // /me/permissions
  let grantedScopes: string[] = [];
  try {
    const permRes = await fetch(`${BASE_URL}/me/permissions?access_token=${encodeURIComponent(accessToken)}`);
    if (permRes.ok) {
      const permData: { data?: Array<{ permission: string; status: string }> } = await permRes.json();
      grantedScopes = (permData.data ?? [])
        .filter((p) => p.status === "granted")
        .map((p) => p.permission);
    }
  } catch { /* ignore */ }

  const businessManagementGranted = grantedScopes.includes("business_management");
  const hasPageScopes =
    grantedScopes.includes("pages_show_list") &&
    grantedScopes.includes("pages_read_engagement");

  // /me/accounts
  let pagesCount = 0;
  try {
    const accountsRes = await fetch(
      `${BASE_URL}/me/accounts?fields=id&access_token=${encodeURIComponent(accessToken)}`
    );
    if (accountsRes.ok) {
      const data: { data?: unknown[] } = await accountsRes.json();
      pagesCount = data.data?.length ?? 0;
    }
  } catch { /* ignore */ }

  // /me/businesses — check if business_management would help
  let businessesAccessible: boolean | null = null;
  try {
    const bizRes = await fetch(
      `${BASE_URL}/me/businesses?fields=id&access_token=${encodeURIComponent(accessToken)}`
    );
    if (bizRes.ok) {
      const data: { data?: unknown[]; error?: { code?: number } } = await bizRes.json();
      businessesAccessible = !data.error;
    } else {
      const data: { error?: { code?: number; message?: string } } = await bizRes.json();
      const msg = data.error?.message?.toLowerCase() ?? "";
      businessesAccessible = !(msg.includes("missing permission") || msg.includes("permission"));
    }
  } catch { /* ignore */ }

  let likelyIssue: PagesDiagnosticIssue = "no_issue_detected";
  if (hasPageScopes && pagesCount === 0) {
    if (!businessManagementGranted && businessesAccessible === false) {
      likelyIssue = "business_manager_permission_required";
    } else {
      likelyIssue = "page_permissions_granted_but_no_pages_returned";
    }
  } else if (!hasPageScopes) {
    likelyIssue = "api_error";
  }

  const result: PagesDiagnostic = {
    grantedScopes,
    pagesCount,
    businessManagementGranted,
    businessesAccessible,
    likelyIssue,
  };
  return NextResponse.json(result);
}
