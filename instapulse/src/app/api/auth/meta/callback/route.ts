import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import { handleOAuthCallback } from "@/services/instagramOAuthService";
import { resolveOAuthAppCredentials } from "@/services/credentialService";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  if (errorParam) {
    const msg = errorDescription || errorParam;
    return NextResponse.redirect(
      `${baseUrl}/dashboard/connect?error=${encodeURIComponent(msg)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${baseUrl}/dashboard/connect?error=${encodeURIComponent("No authorization code received")}`
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.redirect(`${baseUrl}/auth/signin`);
  }

  const user = session.user as { id: string; name?: string | null };

  let workspaceId: string | undefined;
  let connectAnother = false;
  if (stateParam) {
    try {
      const decoded = JSON.parse(Buffer.from(stateParam, "base64url").toString());
      workspaceId = decoded.workspaceId ?? undefined;
      connectAnother = decoded.connectAnother === true;
    } catch {
      // ignore malformed state
    }
  }

  if (!workspaceId) {
    const workspace = await getOrCreateDefaultWorkspace(user.id, user.name);
    workspaceId = workspace.id;
  }

  console.log(`[meta/callback] connectAnother=${connectAnother} workspaceId=${workspaceId}`);

  // Use workspace-specific credentials (BYOK App) or platform credentials (Managed)
  const { appId, appSecret } = await resolveOAuthAppCredentials(workspaceId);
  const redirectUri =
    process.env.META_REDIRECT_URI || `${baseUrl}/api/auth/meta/callback`;

  const result = await handleOAuthCallback(
    workspaceId,
    user.id,
    code,
    appId,
    appSecret,
    redirectUri
  );

  console.log(`[meta/callback] success=${result.success} accountsConnected=${result.accountsConnected} facebookUserId=${result.facebookUserId ?? "unknown"} isExistingMetaIdentity=${result.isExistingMetaIdentity}`);

  if (!result.success) {
    return NextResponse.redirect(
      `${baseUrl}/dashboard/connect?error=${encodeURIComponent(result.error || "Connection failed")}`
    );
  }

  const accountsConnected = result.accountsConnected ?? 0;

  // connect_another flow → always redirect to own-accounts with identity context
  if (connectAnother) {
    const identityParam = result.isExistingMetaIdentity
      ? "reconnected_existing=true"
      : "new_meta_identity=true";
    return NextResponse.redirect(
      `${baseUrl}/dashboard/own-accounts?${identityParam}&connected=${accountsConnected}`
    );
  }

  // Standard flow: multi-account → own-accounts, single → connect success screen
  if (accountsConnected > 1) {
    return NextResponse.redirect(
      `${baseUrl}/dashboard/own-accounts?new_connection=true&connected=${accountsConnected}`
    );
  }

  return NextResponse.redirect(
    `${baseUrl}/dashboard/connect?success=true&connected=${accountsConnected}`
  );
}
