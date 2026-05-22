import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import { buildOAuthUrl } from "@/services/instagramOAuthService";
import { resolveOAuthAppCredentials } from "@/services/credentialService";

export async function GET() {
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

  const redirectUri = process.env.META_REDIRECT_URI || `${process.env.NEXTAUTH_URL}/api/auth/meta/callback`;
  const state = Buffer.from(JSON.stringify({ workspaceId: workspace.id })).toString("base64url");
  const url = buildOAuthUrl(state, appId, redirectUri);

  return NextResponse.json({ url });
}
