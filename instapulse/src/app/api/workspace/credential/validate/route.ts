import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { decryptToken } from "@/lib/encryption";
import {
  getWorkspaceCredentialConfig,
  updateCredentialStatus,
  resolveOAuthAppCredentials,
  checkMissingScopes,
} from "@/services/credentialService";
import { validateAccessToken } from "@/services/instagramApiClient";

/**
 * POST /api/workspace/credential/validate
 * Pings the Meta API to verify current credentials are working.
 * For managed/byok_app: validates one active InstagramConnection token.
 * For byok_token: validates the stored token.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; name?: string | null };
  const workspace = await getOrCreateDefaultWorkspace(user.id, user.name);

  const config = await getWorkspaceCredentialConfig(workspace.id);
  const { appId, appSecret } = await resolveOAuthAppCredentials(workspace.id);

  let tokenToValidate: string | null = null;

  if (config.mode === "byok_token") {
    // Validate the stored BYOK token
    const cred = await db.workspaceCredential.findUnique({ where: { workspaceId: workspace.id } });
    if (cred?.accessTokenEncrypted) {
      tokenToValidate = decryptToken(cred.accessTokenEncrypted);
    }
  } else {
    // Validate first active connection token
    const connection = await db.instagramConnection.findFirst({
      where: { workspaceId: workspace.id, status: "active" },
    });
    if (connection?.accessTokenEncrypted) {
      tokenToValidate = decryptToken(connection.accessTokenEncrypted);
    }
  }

  if (!tokenToValidate) {
    return NextResponse.json({
      valid: false,
      status: "unconfigured",
      message: "No access token found. Connect an Instagram account first.",
    });
  }

  const result = await validateAccessToken(tokenToValidate, appId, appSecret);

  if (!result.valid) {
    await updateCredentialStatus(workspace.id, "invalid", result.error ?? undefined);
    return NextResponse.json({
      valid: false,
      status: "invalid",
      message: result.error || "Token is invalid",
    });
  }

  // Check for expired token
  if (result.expiresAt && result.expiresAt < new Date()) {
    await updateCredentialStatus(workspace.id, "expired", "Access token has expired");
    return NextResponse.json({
      valid: false,
      status: "expired",
      message: "Access token has expired. Reconnect your Instagram account.",
      expiresAt: result.expiresAt,
    });
  }

  // Check for missing permissions
  const missing = checkMissingScopes(result.scopes);
  if (missing.length > 0) {
    await updateCredentialStatus(
      workspace.id,
      "missing_permissions",
      `Missing permissions: ${missing.join(", ")}`
    );
    return NextResponse.json({
      valid: true,
      status: "missing_permissions",
      message: `Token is valid but missing permissions: ${missing.join(", ")}`,
      scopes: result.scopes,
      missingScopes: missing,
    });
  }

  await updateCredentialStatus(workspace.id, "active");

  return NextResponse.json({
    valid: true,
    status: "active",
    message: "Credentials are valid and all required permissions are granted.",
    scopes: result.scopes,
    expiresAt: result.expiresAt,
    instagramUsername: result.instagramUsername,
  });
}
