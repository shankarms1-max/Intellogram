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
  if (stateParam) {
    try {
      const decoded = JSON.parse(Buffer.from(stateParam, "base64url").toString());
      workspaceId = decoded.workspaceId ?? undefined;
    } catch {
      // ignore malformed state
    }
  }

  if (!workspaceId) {
    const workspace = await getOrCreateDefaultWorkspace(user.id, user.name);
    workspaceId = workspace.id;
  }

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

  if (!result.success) {
    return NextResponse.redirect(
      `${baseUrl}/dashboard/connect?error=${encodeURIComponent(result.error || "Connection failed")}`
    );
  }

  return NextResponse.redirect(
    `${baseUrl}/dashboard/connect?success=true&connected=${result.accountsConnected ?? 0}`
  );
}
