import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import { buildOAuthUrl } from "@/services/instagramOAuthService";
import { resolveOAuthAppCredentials } from "@/services/credentialService";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { id: string; name?: string | null };
  const workspace = await getOrCreateDefaultWorkspace(user.id, user.name);

  // Resolve whether to use platform credentials or BYOK App credentials
  const { appId, appSecret } = await resolveOAuthAppCredentials(workspace.id);

  if (!appId || !appSecret || appId === "your-meta-app-id") {
    return NextResponse.json(
      {
        error:
          "Meta API credentials are not configured. " +
          "Set META_APP_ID and META_APP_SECRET in your .env file, " +
          "or configure your own Meta App credentials in the Connect page.",
      },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  // force_reauth=1 → adds auth_type=reauthenticate to the Facebook dialog URL so
  // Facebook shows the login screen instead of silently reusing the existing session.
  const forceReauth = searchParams.get("force_reauth") === "1";
  // connect_another=1 → encoded in state so the callback redirects to own-accounts
  // with the appropriate banner (new identity vs. same identity reconnected).
  const connectAnother = searchParams.get("connect_another") === "1";

  console.log(`[meta/start] forceReauth=${forceReauth} connectAnother=${connectAnother}`);

  const redirectUri = process.env.META_REDIRECT_URI || `${process.env.NEXTAUTH_URL}/api/auth/meta/callback`;
  const state = Buffer.from(
    JSON.stringify({
      workspaceId: workspace.id,
      ...(connectAnother ? { connectAnother: true } : {}),
    })
  ).toString("base64url");

  const url = buildOAuthUrl(state, appId, redirectUri, { forceReauth });

  console.log(`[meta/start] OAuth URL contains auth_type=reauthenticate: ${url.includes("auth_type=reauthenticate")}`);

  return NextResponse.json({ url });
}
